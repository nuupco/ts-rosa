# Auditoría técnica de JavaRosa — base de diseño para `ts-rosa`

> **Propósito.** Comprender el comportamiento esperado de un motor de XForms a partir de la
> implementación de referencia (JavaRosa, getodk/javarosa) para diseñar una reimplementación
> moderna en TypeScript. **No es una traducción literal**: se replica comportamiento, no código.
>
> **Estado.** Auditoría previa al diseño. No se ha escrito código de producción.
>
> **Convención de cada decisión de diseño:**
> 1. *Qué hace JavaRosa hoy.*
> 2. *Por qué se mantiene o se cambia.*
> 3. *Ventaja de la nueva implementación en TypeScript.*

Referencia local: `reference/javarosa` (328 archivos de producción, 134 de test).

---

## 1. Arquitectura general

JavaRosa es un motor de formularios basado en el estándar **W3C XForms** con extensiones de **ODK**.
Su trabajo es: tomar un documento XForm (XML), construir un modelo ejecutable, permitir llenarlo
pregunta por pregunta evaluando lógica reactiva (relevancia, cálculos, validación), y serializar las
respuestas a XML de submission.

La arquitectura gira en torno a **dos árboles paralelos** que nunca se referencian directamente:

- **Árbol de definición** (`FormDef → GroupDef | QuestionDef`): estructura de presentación,
  etiquetas, apariencia, tipo de control. Inmutable durante el llenado.
- **Árbol de instancia** (`FormInstance → TreeElement`): los datos del usuario, mutable durante el
  llenado, además de estado derivado (relevancia, habilitado, multiplicidad de repeticiones).

El puente entre ambos es **`TreeReference`** (una ruta XPath tipada). Cada elemento de definición
tiene un *binding* que apunta, vía `TreeReference`, a uno o más nodos de la instancia.

Sobre estos dos árboles operan tres motores:

| Motor | Responsabilidad |
|---|---|
| **Parser XForms** | XML → `FormDef` + `FormInstance` + bindings + triggerables |
| **Motor XPath** | Evalúa expresiones (relevancia, cálculo, constraint, predicados de ruta) |
| **DAG de triggerables** | Orquesta la recalculación reactiva en orden topológico |

Capa de aplicación (`form/api`) expone la sesión de llenado: navegación entre preguntas, manejo de
repeticiones, validación y snapshots de lectura para la UI.

```
┌──────────────────────────────────────────────────────────────┐
│  Capa de aplicación  (form/api)                                │
│  FormEntryController · FormEntryModel · FormEntryPrompt         │
│  navegación · answerQuestion · repeats · validación            │
└───────────────┬───────────────────────────┬──────────────────┘
                │                            │
        ┌───────▼────────┐          ┌────────▼─────────┐
        │  Árbol de       │  bind   │  Árbol de         │
        │  DEFINICIÓN     │◄───────►│  INSTANCIA        │
        │  FormDef        │ TreeRef │  FormInstance     │
        │  Group/Question │         │  TreeElement      │
        └───────┬─────────┘         └────────┬──────────┘
                │                            │
        ┌───────▼────────────────────────────▼──────────┐
        │  Motor XPath  +  TriggerableDag (reactividad)  │
        └───────▲────────────────────────────────────────┘
                │ construye todo
        ┌───────┴────────┐
        │  Parser XForms │  (XFormParser + FormInstanceParser)
        └───────▲────────┘
                │ DOM
        ┌───────┴────────┐
        │  XML (kXML2)   │
        └────────────────┘
```

---

## 2. Diagrama de módulos

Paquetes principales bajo `org.javarosa`:

```
core/
  model/                 ← corazón del dominio
    FormDef               (raíz del árbol de definición, "God Object")
    GroupDef, QuestionDef, DataBinding
    FormIndex             (cursor de navegación, value object inmutable)
    TriggerableDag, QuickTriggerable
    condition/            Triggerable, Condition, Recalculate, EvaluationContext, Constraint
    instance/             FormInstance, DataInstance, TreeElement, TreeReference, TreeReferenceLevel
    data/                 IAnswerData + StringData, IntegerData, DateData, SelectOneData, GeoPointData…
    actions/              setvalue, odk:recordaudio, odk:setgeopoint…
  reference/             ReferenceManager (URIs jr://…) — específico de runtime Android
  services/              localización (Localizer), logging, transporte
  io/                    serialización binaria de bajo nivel

xform/
  parse/                 XFormParser, FormInstanceParser, StandardBindAttributesProcessor
  util/                  XFormAnswerDataSerializer, XFormSerializer

xml/                     TreeElementParser, ElementParser (pull-parsing de instancias externas)

xpath/
  parser/                Lexer, Parser, Token, ast/ (AST intermedio)
  expr/                  XPathExpression + subtipos (AST de evaluación), XPathFuncExpr
  XPathNodeset, XPathLazyNodeset, EvaluationContext (compartido con core)

model/xform/             XFormSerializingVisitor, CompactSerializingVisitor (SMS), DataModelSerializer

form/api/                FormEntryController, FormEntryModel, FormEntryPrompt, FormEntryCaption

test/  (en src/main)     Scenario, XFormsElement (DSL declarativo de formularios para tests)
```

Dependencias de alto nivel (flechas = "depende de"):

```
form/api  ──►  core/model  ──►  xpath/expr  ──►  core/model/instance
   │                │                              ▲
   └────────────────┴──────────────────────────────┘
xform/parse  ──►  core/model  +  xpath/parser  +  xml
model/xform  ──►  core/model/instance  +  xform/util
```

---

## 3. Modelo de datos

### 3.1 Árbol de definición

| Clase | Responsabilidad |
|---|---|
| `IFormElement` | Interfaz base; `getChildren()`, `getBind()` (→ `IDataReference`) |
| `FormDef` | Raíz. Contiene children, instancias, `TriggerableDag`, `ActionController` |
| `GroupDef` | `<group>` **y** `<repeat>` distinguidos por `boolean repeat`; `count`, `noAddRemove`, captions |
| `QuestionDef` | Hoja. `controlType`, `choices` estáticos, `ItemsetBinding` dinámico, `binding` |
| `DataBinding` | Modela `<bind>`: `ref`, `dataType`, condiciones (relevant/required/readonly/calculate) y `constraint` |

### 3.2 Árbol de instancia

| Clase | Responsabilidad |
|---|---|
| `FormInstance` | Instancia primaria (datos del usuario); raíz oculta, `schema`, `formVersion` |
| `DataInstance<T>` | Superclase; primarias y secundarias; `resolveReference()` |
| `TreeElement` | Nodo mutable: `name`, `multiplicity`, `value: IAnswerData`, `children`, `attributes`, `dataType`, `constraint`, `flags` (bitmask con RELEVANT/ENABLED/REQUIRED…) |
| `TreeReference` | Ruta absoluta/relativa a nodo(s); `refLevel`, `instanceName`, lista de `TreeReferenceLevel` |
| `TreeReferenceLevel` | Segmento de ruta: `name` (o `*`), `multiplicity`, `predicates: XPathExpression[]` |

**Multiplicidad** (clave para repeticiones): `0,1,2…` posición; `INDEX_UNBOUND (-1)` comodín;
`INDEX_TEMPLATE (-2)` nodo molde de un repeat (nunca se serializa); `INDEX_ATTRIBUTE (-4)`.

### 3.3 Tipos de dato (`IAnswerData`)

Value objects con `getValue()/setValue()/getDisplayText()/uncast()/cast()`. Implementaciones:
`StringData, IntegerData, LongData, DecimalData, BooleanData, DateData, TimeData, DateTimeData,
SelectOneData, SelectMultiData/MultipleItemsData, GeoPointData, GeoShapeData, GeoTraceData,
UncastData` (string sin tipo, intermediario de conversión).

### 3.4 Diagrama relacional

```
FormDef ──1:1── FormInstance (mainInstance)
   │               │
   │ children      │ root (hidden)
   ▼               ▼
GroupDef/QuestionDef ──getBind()──► IDataReference ──resolve──► TreeElement
   │                                                              │ value
DataBinding ──ref──────────────────────────────────────────────► IAnswerData
   │ relevant/required/readonly/calculate (Triggerable)           ▲
   ▼                                                              │ targets
TriggerableDag ── QuickTriggerable ── Condition/Recalculate ──────┘
```

---

## 4. Flujo de ejecución de un formulario

### 4.1 Carga

```
XFormParser.parse()
  → getXMLDocument()              XML → DOM kXML2
  → parseDoc()
      → parseElement(model)       itext, instances (lazy), binds → Triggerables
      → parseElement(body)        controles, grupos, repeats
      → collapseRepeatGroups()
      → FormInstanceParser.parseInstance()    DOM → TreeElement
      → applyInstanceProperties()  aplica dataType/relevant/required/constraint a nodos
  → finalizeTriggerables()        orden topológico del DAG + detección de ciclos
  → initializeInstance()          registra jr:itext, jr:choice-name; evaluación inicial
```

### 4.2 Sesión de llenado (navegación)

```
FormEntryController.stepToNextEvent()
  → loop: FormEntryModel.incrementIndex() hasta isIndexRelevant()
  → devuelve EVENT_*  (BEGINNING_OF_FORM | QUESTION | GROUP | REPEAT |
                       PROMPT_NEW_REPEAT | REPEAT_JUNCTURE | END_OF_FORM)
  → cliente: FormEntryModel.getQuestionPrompt() → FormEntryPrompt(form, index)
```

`FormIndex` es la "dirección" inmutable del nodo actual (lista enlazada de niveles con
`localIndex`/`instanceIndex`). El skip de no-relevantes ocurre en el loop de navegación; la
relevancia ya está calculada en el `TreeElement` por el DAG.

### 4.3 Responder una pregunta

```
FormEntryController.answerQuestion(index, data)
  → if required && data==null  → ANSWER_REQUIRED_BUT_EMPTY
  → FormDef.evaluateConstraint(ref, data)  → false → ANSWER_CONSTRAINT_VIOLATED
  → commitAnswer → FormDef.setValue()
        → TreeElement guarda el valor
        → TriggerableDag.triggerTriggerables(ref)
              → expande cascada (ImmediateCascades, ya computada)
              → evalúa triggerables en orden DAG
              → actualiza relevancia/valor en TreeElements destino
        → dispara actions EVENT_QUESTION_VALUE_CHANGED
```

### 4.4 Repeticiones en runtime

- **Crear**: clona el `TreeElement` template, aplica preloaders, dispara actions `odk-new-repeat`,
  `dagImpl.createRepeatInstance()` (2 fases: triggers externos + init interno).
- **Eliminar**: `removeChild` + reindexa multiplicidades de hermanos +
  `dagImpl.deleteRepeatInstance()`; devuelve el `FormIndex` resultante.

### 4.5 Validación completa y serialización

- `FormDef.validate()` → `TriggerableDag.validate()` recorre todo el formulario llamando
  `answerQuestion` con los valores existentes; retorna `ValidateOutcome(failedPrompt, outcome)` o
  `null`.
- `XFormSerializingVisitor` recorre la instancia depth-first, descarta nodos no relevantes y
  templates, y produce XML UTF-8 (o `MultiMessagePayload` si hay adjuntos).

---

## 5. Flujo de evaluación de expresiones

```
XPathPathExpr.eval(instance, EvaluationContext)
  → getReference()                       steps → TreeReference genérico
  → XPathPathExprEval.eval()
       → genericRef.contextualize(contextRef)   relativa → absoluta
       → selecciona DataInstance (main o named: instance('id'))
       → ec.expandReference(ref)         resuelve INDEX_UNBOUND + predicados
             → recorre nivel por nivel (getChildrenWithName)
             → filterWithPredicate() vía FilterStrategy chain
       → removeIrrelevantNodesets()
       → XPathNodeset(refs, instance, ec)
```

**`EvaluationContext`** transporta: `contextNode`, `original` (para `current()`), `instance`,
`formInstances` (secundarias), `functionHandlers`, `variables`, `currentContextPosition`
(para `position()`), modo `isConstraint`+`candidateValue`, y la cadena de `FilterStrategy`.

Tipos de valor XPath: `Boolean | Double | String | Date | XPathNodeset`. Coerción en `=`/`!=`:
prioridad Boolean > Double > String; comparación de doubles con tolerancia `1e-12`.

Optimización `XPathLazyNodeset`: si la ref no tiene predicados y los multiplicities son resolubles
directamente, evita la expansión completa.

---

## 6. Organización del parser

### 6.1 Parser XForms (`XFormParser`, ~2545 líneas)

- **DOM-first**: materializa todo el XML en un DOM kXML2 antes de procesar (no streaming, salvo
  `TreeElementParser` para instancias externas).
- **Handlers por tag**: tres `HashMap<String, IElementHandler>` estáticos (`topLevelHandlers`,
  `groupLevelHandlers`, `actionHandlers`). `parseElement()` despacha por nombre; tags desconocidos
  se ignoran con warning.
- **Fases**: (A) parse del body → guarda `IDataReference` en controles; (B) `buildInstanceStructure`
  → DOM a `TreeElement`; (C) `applyInstanceProperties` → aplica dataType/relevancia/constraint a cada
  nodo. Las instancias secundarias se parsean **lazy** (solo si `instance('id')` las referencia).
- **Extensibilidad**: `addProcessor()` (BindAttribute/ModelAttribute/Question/FormDef/XPath
  Processor) + `registerActionHandler()`. Punto débil: handlers y `parseLock` son **estáticos**.

### 6.2 Bindings

`StandardBindAttributesProcessor.createBinding()` lee `nodeset, type, relevant, required, readonly,
calculate, constraint, jr:preload, jr:constraintMsg`, compila los XPath a `XPathConditional` y
registra los `Triggerable` en el `FormDef`.

---

## 7. Organización del motor XPath

```
Lexer (a mano)  →  Token[]  →  Parser (multipasada)  →  AST intermedio (parser/ast)
                                                              │ .build()
                                                              ▼
                                                     AST de evaluación (expr/)
                                                     XPathExpression.eval(...)
```

- **Lexer** (`Lexer.lex`): tokenizador a mano con estado de contexto (VAL/OP) para desambiguar `*`
  (wildcard vs mult) y `-` (unario vs binario).
- **Parser** (`Parser`): descenso iterativo en **múltiples pasadas** sobre una lista plana mixta de
  tokens y subnodos (`ASTNodeAbstractExpr`). Pasadas: funciones → paréntesis → predicados →
  operadores (por precedencia) → rutas. Marcado en el código como frágil
  (*"if you try to edit this code, you will likely break it"*).
- **AST de evaluación** (`expr/`): jerarquía `XPathExpression` con `eval()` por nodo: literales,
  `XPathArithExpr`, `XPathBoolExpr`, `XPathCmpExpr`, `XPathEqExpr`, `XPathUnionExpr`,
  `XPathFuncExpr`, `XPathPathExpr`, `XPathStep` (13 ejes declarados, ~5 soportados realmente).
- **Funciones** (`XPathFuncExpr.eval`): mega `if-else` de ~80 funciones. Estándar XPath 1.0 + subset
  XPath 3.0 (trig/math) + extensiones ODK. Funciones custom vía `IFunctionHandler` /
  `IFallbackFunctionHandler`.

---

## 8. Responsabilidades de cada paquete

| Paquete | Responsabilidad |
|---|---|
| `core/model` | Modelo de definición, DAG reactivo, índice de navegación |
| `core/model/instance` | Árbol de datos mutable y referencias |
| `core/model/data` | Tipos de respuesta (value objects) |
| `core/model/condition` | Triggerables, contexto de evaluación, constraints |
| `core/model/actions` | Acciones XForms (setvalue, recordaudio, setgeopoint) |
| `core/reference` | URIs virtuales `jr://…` (acoplado a runtime Android) |
| `core/services` | Localización, logging, transporte |
| `xform/parse` | Parser XForms y de instancia, procesadores de bind |
| `xform/util` | Serialización de respuestas a XML |
| `xml` | Pull-parsing de instancias externas |
| `xpath/parser` | Lexer, parser y AST intermedio |
| `xpath/expr` | AST de evaluación y catálogo de funciones |
| `model/xform` | Visitors de serialización (XML estándar, SMS compacto) |
| `form/api` | API de sesión de llenado (navegación, respuestas, validación) |
| `test` (en main) | DSL `Scenario`/`XFormsElement` para tests de comportamiento |

---

## 9. Clases más importantes

| Clase | Por qué importa |
|---|---|
| `FormDef` | Raíz del modelo; orquesta todo (candidata a dividir) |
| `TreeElement` | Nodo de datos en runtime; centro de la mutabilidad |
| `TreeReference` | Identificador de nodos; puente definición↔datos↔XPath |
| `TriggerableDag` | Motor reactivo; garantiza consistencia de cálculos/relevancia |
| `Triggerable` / `Condition` / `Recalculate` | Unidades de lógica reactiva |
| `EvaluationContext` | Estado de evaluación XPath compartido |
| `XPathExpression` (+ subtipos) | AST ejecutable |
| `XPathFuncExpr` | Catálogo de funciones |
| `XFormParser` / `FormInstanceParser` | Construcción del modelo desde XML |
| `FormEntryController` / `FormEntryModel` / `FormEntryPrompt` | API de llenado |
| `FormIndex` | Cursor de navegación inmutable |
| `XFormSerializingVisitor` | Serialización de respuestas |
| `Scenario` | DSL de tests — clave para portar casos de equivalencia |

---

## 10. Posibles mejoras aprovechando TypeScript

Formato: **JavaRosa hoy → por qué cambiar → ventaja en TS.**

### 10.1 Mantener (decisiones válidas que se conservan)

| Decisión | Por qué se mantiene | Forma en TS |
|---|---|---|
| Dos árboles separados (definición/instancia) | XForms lo exige; modelo mental correcto | `FormDefinition` vs `InstanceTree`, sin acoplar |
| `TreeReference` como ruta tipada | Mecanismo correcto para refs absolutas/relativas + predicados | Tipo inmutable con segmentos |
| DAG topológico de triggerables | Garantiza consistencia; coste pagado una vez al cargar | Mismo algoritmo, grafo explícito |
| `IAnswerData` como value object | Contrato `get/set/cast` sano; "null fuera = ausencia" | Union discriminada + funciones puras |
| Template `INDEX_TEMPLATE` para repeats | Solución elegante a "qué clonar" | Conservar como marcador |
| `FormIndex` inmutable | Captura bien la anidación grupos/repeats | Union discriminada `BOF | EOF | {…}` |
| Handler-map por tag en el parser | Idiomático y extensible | `Map<string, Handler>` |
| Parse lazy de instancias secundarias | Ahorra trabajo real | Conservar |
| `IFunctionHandler` / fallback | Extensión sin tocar el core (p. ej. `pulldata`) | `FunctionRegistry` inmutable |

### 10.2 Simplificar

| JavaRosa hoy | Por qué cambiar | Ventaja en TS |
|---|---|---|
| 3 listas paralelas en `incrementHelper` | Reliquia de J2ME, imperativo opaco | Array de objetos `{index, multiplicity, element}` |
| `GroupDef` con `boolean repeat` | Comprobaciones en runtime donde cabe tipado | `Group` y `Repeat extends Group` (o union) |
| `QuickTriggerable` wrapper | Optimización de `equals()` en Java | `Map/Set` por referencia, sin wrapper |
| `IAnswerData.wrapData()` en la interfaz | Mezcla construcción con contrato | Función factory tipada externa |
| `DataType` enum con int legado | Valores numéricos por serialización binaria | String union limpio |
| DOM kXML2 propio + parsing destructivo | Existe `DOMParser` nativo (browser/Node) | Usar DOM W3C estándar |
| Dispatch `instanceof` en serialización | Frágil, no exhaustivo | `Map<DataType, encoder>` con exhaustive check |
| Tres visitors SMS | Solo si se necesita SMS | Un `formatInstance({mode})` |
| `FormEntryCaption` como base de `Prompt` | Herencia sin polimorfismo real | Composición + helper i18n |

### 10.3 Rediseñar

| JavaRosa hoy | Por qué cambiar | Ventaja en TS |
|---|---|---|
| Estado de UI (relevant/enabled) en `TreeElement` | Acopla datos con presentación (TODO reconocido en el código) | `InstanceNode` (datos) vs `NodeState` (derivado por el DAG) |
| `FormDef` God Object | Mezcla parse, evaluación, serialización, navegación | Separar `FormDefinition` / `FormSession` / `FormEvaluator` |
| Modelo de eventos como `int` EVENT_* | Obliga a `switch` y consultas extra al model | Union discriminada `FormEvent` typesafe |
| Observer ad hoc en `FormEntryPrompt` | Frágil, register/unregister manual, leaks | Estado inmutable + derivaciones reactivas (signals/RxJS) |
| `setQuestionIndex` crea repeats como side effect | Comportamiento sorpresivo | Separar navegación de creación de datos |
| Parser XPath multipasada frágil | Inmantenible por diseño | Descenso recursivo clásico o PEG (`peggy`) con AST tipado |
| Serialización `Externalizable` embebida | Acopla dominio con persistencia binaria J2ME | Codecs externos; JSON si hace falta |
| `immediateCascades` dentro de `Triggerable` | TODO del propio código: debe vivir en el DAG | El DAG es único dueño del grafo |
| Interning global mutable (`CacheTable`) | Estado global complica testing | Inmutabilidad + GC, o `WeakMap` local |
| Estado estático en el parser (`parseLock`, handlers) | Antipatrón; sin sentido en runtime single-thread | Estado por instancia del parser |
| URIs virtuales `jr://…` | Específico de Android | El caller pasa datos ya resueltos (`Map<id, Document>`) |
| Tipo de retorno `Object` en XPath | Fuente de bugs | Union estricta `XPathValue` + coerciones tipadas |
| Ejes XPath declarados pero no soportados | 13 declarados, ~5 reales | Documentar subconjunto soportado como contrato |

---

## 11. Riesgos de una reimplementación

| Riesgo | Descripción | Mitigación |
|---|---|---|
| **Equivalencia semántica de XPath** | Coerciones, tolerancia `1e-12`, semántica de nodesets y `position()`/`current()` son sutiles | Portar `XPathEvalTest` y `XPathFuncExprTest` como suite de equivalencia desde el día 1 |
| **Orden de evaluación del DAG** | El orden topológico y la expansión de cascadas afectan resultados observables | Replicar `TriggerableDag` con tests de `TriggerableDagTest` (cascadas, auto-referencia, codependencia) |
| **Semántica de relevancia + serialización** | Qué se incluye/excluye del submission depende de relevancia heredada y templates | Tests de round-trip de instancia con `respectRelevance` |
| **Repeticiones anidadas + multiplicidad** | Creación/borrado reindexa y dispara DAG en 2 fases | Portar `RepeatTest` y fixtures de repeats anidados |
| **Funciones ODK no estándar** | `indexed-repeat`, `randomize`, `once`, `digest`, geo, `jr:choice-name`, `jr:itext` | Catálogo explícito + tests por función |
| **`pulldata` y extensiones del cliente** | No están en JavaRosa; son handlers externos | Diseñar el `FunctionRegistry` extensible desde el inicio |
| **Diferencias de parser XML** | DOM W3C vs kXML2 (namespaces, consolidación de texto, orden) | Tests de parser con fixtures reales (`XFormParserTest`) |
| **Fechas/zonas horarias** | ISO 8601, `today`/`now`, formatos `format-date` | Tests con fechas fijas; cuidado con `Date` de JS |
| **Alcance excesivo** | Portar SMS, persistencia binaria, `jr://` sin necesidad | Recortar a lo que `ts-rosa` realmente necesita |
| **Pérdida de comportamiento "no documentado"** | Mucho comportamiento solo vive en tests | El DSL `Scenario` es la fuente de verdad: portarlo temprano |

---

## 12. Lista priorizada de funcionalidades

Orden sugerido de implementación (cada fase entrega valor verificable contra los tests de JavaRosa):

**Fase 0 — Infraestructura de equivalencia**
1. Puerto del DSL `Scenario` + `XFormsElement` (init/answer/next/prev/repeats/serialize).
2. `AnswerResult` (`OK | REQUIRED_BUT_EMPTY | CONSTRAINT_VIOLATED`).
3. Arnés que ejecute los fixtures XML de JavaRosa como casos de equivalencia.

**Fase 1 — Núcleo de datos**
4. Tipos `IAnswerData` (string, int, decimal, boolean, fechas, select one/multi).
5. Árbol de instancia (`InstanceNode`/`TreeReference`) y resolución de referencias.
6. Parser XForms mínimo (model, instance, binds, body con input/select) sobre DOM nativo.

**Fase 2 — Motor XPath**
7. Lexer + parser (descenso recursivo o PEG) con AST tipado.
8. Evaluación de paths, operadores, coerciones, `EvaluationContext`.
9. Funciones estándar XPath 1.0 + coerciones de igualdad.

**Fase 3 — Reactividad**
10. `Triggerable`/`Condition`/`Recalculate` + DAG topológico con detección de ciclos.
11. Relevancia (incl. heredada), `calculate`, `required`, `readonly`.
12. Validación de `constraint` + mensajes (`jr:constraintMsg`, itext).

**Fase 4 — Navegación y repeticiones**
13. `FormIndex` + `FormEntryController`/`Model` con eventos como union discriminada.
14. Repeticiones: crear/eliminar/navegar, templates, 2 fases del DAG.
15. Grupos y relevancia de grupos/repeats.

**Fase 5 — Selects dinámicos e i18n**
16. `itemset` dinámico desde instancias secundarias + filtros de choices.
17. iText/Localizer, `jr:itext`, `jr:choice-name`.
18. Instancias secundarias (internas y externas: CSV/GeoJSON/XML).

**Fase 6 — Serialización y funciones ODK**
19. Serialización de instancia a XML (filtrado relevancia + templates).
20. Funciones ODK: `indexed-repeat`, `randomize`, `once`, `uuid`, `digest`, geo (`area`,
    `distance`, `geofence`), `format-date`, `regex`, `pulldata` (vía registry).

**Fase 7 — Validación E2E**
21. Validación completa del formulario (`validate()`).
22. Smoke tests con formularios reales (`child_vaccination`, `whova`).

> **Funcionalidades fuera de alcance por defecto** (incluir solo si el producto lo pide):
> serialización SMS/compacta, persistencia binaria `Externalizable`, URIs `jr://`, preloaders
> específicos de dispositivo, transporte/submission HTTP.
