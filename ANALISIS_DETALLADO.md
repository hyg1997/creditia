# Analisis Detallado: Estado Actual vs. Cambios del Video

> Cada cambio mapeado al codigo exacto (archivo:linea), con estado actual, estado deseado, complejidad estimada, y dependencias.

---

## RESUMEN EJECUTIVO

| Categoria | Cambios | Complejidad |
|-----------|---------|-------------|
| Eliminar elementos | 12 | Baja |
| Renombrar/retextear | 8 | Baja |
| Reformateo visual (compactar) | 15 | Media |
| Nuevos componentes | 4 | Alta |
| Nueva logica de negocio | 7 | Alta |
| Reestructuracion de layout | 5 | Alta |
| **Total** | **51 cambios** | |

---

## SECCION A: ELIMINAR ELEMENTOS

### A1. Eliminar pestanas "Calculadora" / "Asesoria"
- **Archivo:** `src/app/page.tsx:1241-1264`
- **Estado actual:** Dos botones tab `activeTab === "calculadora"` y `activeTab === "asesoria"` dentro de `<div className="flex gap-1 bg-wv-surface rounded-xl...">`
- **Estado deseado:** Eliminar completamente. Todo el contenido en una sola vista.
- **Impacto:** El estado `activeTab` (linea 712) y el tipo `Tab` (linea 704) se pueden eliminar. El bloque condicional `{activeTab === "calculadora" && (<>` (linea 1266) y `{activeTab === "asesoria" && isLey73 && (` (linea 2115) deben fusionarse en un solo render.
- **Contenido de Asesoria a conservar:** MetricCard grid (lineas 2123-2141), Mes Pension Pronta (lineas 2145-2207), Escenarios de Pension (lineas 2210-2286). Todo esto se integra a la vista unica.
- **Complejidad:** Baja — eliminar tabs y mover contenido.

### A2. Eliminar componente banner "Acredita Financiamiento Futuro" (redundante)
- **Archivo:** `src/app/page.tsx:1268-1384`
- **Estado actual:** Banner superior con logica if/else que muestra uno de: "Acredita Financiamiento Ahora" (linea 1306), "Acredita Financiamiento Futuro" (linea 1322), "Acredita Recuperacion de Derechos" (linea 1343), "Acredita Actualizacion Pension Minima" (linea 1362), "No acredita" (linea 1378).
- **Estado deseado:** Reemplazar con banner que muestre la calificacion de MAYOR PRIORIDAD (ver cambio E1). El banner actual se elimina y se reemplaza con logica nueva.
- **Complejidad:** Media — la logica del banner cambia completamente.

### A3. Eliminar subtitulo "Pension inmediata" de Financiamiento Ahora
- **Archivo:** `src/app/page.tsx:1721-1723`
- **Codigo actual:** `<p className="text-[10px]...">Pensión inmediata</p>`
- **Estado deseado:** Eliminar esta linea.
- **Complejidad:** Trivial.

### A4. Eliminar subtitulo "Planeacion a pension" de Financiamiento Futuro
- **Archivo:** `src/app/page.tsx:1755-1757`
- **Codigo actual:** `<p className="text-[10px]...">Planeación a pensión</p>`
- **Estado deseado:** Eliminar esta linea.
- **Complejidad:** Trivial.

### A5. Eliminar subtitulo "Reingreso via Mod 10" de Recuperacion de Derechos
- **Archivo:** `src/app/page.tsx:1789-1791`
- **Codigo actual:** `<p className="text-[10px]...">Reingreso vía Mod 10</p>`
- **Estado deseado:** Eliminar esta linea.
- **Complejidad:** Trivial.

### A6. Eliminar subtitulo "Actualizar al ano vigente" de Act. Pension Minima
- **Archivo:** `src/app/page.tsx:1828-1830`
- **Codigo actual:** `<p className="text-[10px]...">Actualizar al año vigente</p>`
- **Estado deseado:** Eliminar esta linea.
- **Complejidad:** Trivial.

### A7. Eliminar criterio ">= 2 anos sin cotizar" de Act. Pension Minima
- **Archivo:** `src/app/page.tsx:1849-1853`
- **Codigo actual:** `<SubCheck pass={actMinCumpleSinCotizar} label="≥ 2 años sin cotizar" value={...} />`
- **Estado logica:** `actMinCumpleSinCotizar = diasSinCotizar >= 730` (linea 851)
- **Estado deseado:** Eliminar el SubCheck. El criterio ya NO descalifica (pero el video dice mostrar fecha en que dejo de cotizar como dato informativo).
- **Impacto en logica:** En linea 890, `actMinAcredita` incluye `&& actMinCumpleSinCotizar`. Debe removerse de la condicion.
- **Complejidad:** Baja — eliminar UI + quitar de formula booleana.

### A8. Eliminar "PROMEDIO SALARIAL" y "SEMANAS COTIZADAS" del Resumen Financiero
- **Archivo:** `src/components/results-summary.tsx`
- **Estado actual:** El componente `ResultsSummary` recibe `promedioSalarial` y `totalSemanas` como props y los muestra como MetricCards.
- **Estado deseado:** Eliminar estas dos metricas del resumen. Se muestran en "Informacion del Lead" (nuevo componente).
- **Complejidad:** Baja.

### A9. Eliminar tablas "Desglose de Cuentas" del flujo principal
- **Archivo:** `src/app/page.tsx:2061-2069`
- **Estado actual:** `<section>` completa con `<AforeBreakdown afore={result.afore} />` que renderiza tablas SAR, RCV, INFONAVIT.
- **Estado deseado:** Mover dentro del desplegable "AFORE" (nuevo formato). No eliminar el componente, solo reubicarlo dentro de un colapsable.
- **Complejidad:** Baja — mover dentro de un DetailToggle.

### A10. Eliminar texto explicito "Cumple" / "No cumple" — reemplazar con color
- **Archivos afectados:**
  - `src/app/page.tsx:558-617` — `StatusBadge` y `SubCheck` componentes
  - Todas las tarjetas de calificacion (lineas 1711-1862)
  - Todas las validaciones (lineas 1387-1951)
- **Estado actual:** `StatusBadge` muestra badge con texto "Cumple"/"No cumple" con checkmark/X. `SubCheck` muestra `Cumple — valor` o `No cumple — valor` como texto.
- **Estado deseado:** Eliminar los badges/textos "Cumple"/"No cumple". Solo usar COLOR: valor en rojo si no cumple, valor en negro/verde si cumple. El titulo de la seccion tambien se pone rojo si no cumple.
- **Impacto:** Requiere reescribir `StatusBadge` (o eliminar) y `SubCheck` para que solo muestren el valor con color condicional. Todos los usos deben actualizarse.
- **Complejidad:** Media — muchos puntos de uso.

### A11. Eliminar etiqueta "No estar pensionado" de validaciones
- **Archivo:** No existe actualmente en el codigo. Era una referencia al Excel del video. No requiere accion de eliminacion, pero la nueva pregunta "Esta pensionado?" (ver E2) la reemplaza.
- **Complejidad:** N/A.

### A12. Eliminar seccion "Promedio Salarial" como seccion separada
- **Archivo:** `src/app/page.tsx:2071-2082`
- **Estado actual:** Seccion independiente con `<SalaryAverageBreakdown .../>`.
- **Estado deseado:** Mover a un desplegable dentro de "Informacion del Lead". No eliminar el componente, solo reubicarlo.
- **Complejidad:** Baja — mover dentro de colapsable.

---

## SECCION B: RENOMBRAR / RETEXTEAR

### B1. "Financiamiento Ahora" -> "Ahora"
- **Archivo:** `src/app/page.tsx:1718-1720`
- **Codigo actual:** `<p className="font-semibold...">Financiamiento Ahora</p>`
- **Estado deseado:** `<p>Ahora</p>`
- **Complejidad:** Trivial.

### B2. "Financiamiento Futuro" -> "Futuro"
- **Archivo:** `src/app/page.tsx:1752-1754`
- **Codigo actual:** `<p className="font-semibold...">Financiamiento Futuro</p>`
- **Estado deseado:** `<p>Futuro</p>`
- **Complejidad:** Trivial.

### B3. "Recuperacion de Derechos" -> "Recuperar Derechos"
- **Archivo:** `src/app/page.tsx:1786-1788`
- **Codigo actual:** `<p className="font-semibold...">Recuperación de Derechos</p>`
- **Estado deseado:** `<p>Recuperar Derechos</p>`
- **Complejidad:** Trivial.

### B4. "Act. Pension Minima" -> "Actualizacion Pension Minima"
- **Archivo:** `src/app/page.tsx:1825-1827`
- **Codigo actual:** `<p className="font-semibold...">Act. Pensión Mínima</p>`
- **Estado deseado:** `<p>Actualización Pensión Mínima</p>`
- **Complejidad:** Trivial.

### B5. Etiqueta "Costo" -> "Requerimiento" en Saldo AFORE
- **Archivo:** `src/app/page.tsx:1483-1485`
- **Codigo actual:** `Costo: {formatMXN(costoAnual)}/año...`
- **Estado deseado:** `Requerimiento: {formatMXN(costoAnual)}/año...`
- **Complejidad:** Trivial.

### B6. "Resumen Financiero" -> "AFORE"
- **Archivo:** `src/app/page.tsx:2043`
- **Codigo actual:** `<h2>Resumen Financiero</h2>`
- **Estado deseado:** `<h2>AFORE</h2>`
- **Complejidad:** Trivial.

### B7. Indicadores "Acredita"/"No acredita" en vez de "Cumple"/"No cumple"
- **Archivo:** `src/app/page.tsx` — tarjetas ya usan `labelPass="Acredita"` (lineas 1727-1728, etc.)
- **Estado actual:** Las tarjetas de financiamiento ya usan "Acredita"/"No acredita". Pero Validaciones usan "Cumple"/"No cumple".
- **Estado deseado:** Consistencia: tarjetas = "Acredita"/"No acredita", validaciones internas = sin texto (solo color).
- **Complejidad:** Baja.

### B8. RP completo -> solo ultimos 2 digitos
- **Archivo:** `src/app/page.tsx:1603`
- **Codigo actual:** `RP: {ultimoRegistro?.registroPatronal}`
- **Estado deseado:** `RP: {ultimoRegistro?.registroPatronal.slice(-2)}` (solo "10" o "40")
- **Complejidad:** Trivial.

---

## SECCION C: REFORMATEO VISUAL (COMPACTAR)

### C1. Validaciones: cada criterio en UNA linea
- **Estado actual:** Cada validacion (Ley 73, Semanas, AFORE, Modalidad) es un recuadro separado con multiples lineas.
  - Ley 73: lineas 1397-1411 (recuadro propio)
  - Semanas: lineas 1414-1471 (recuadro propio con DetailToggle)
  - AFORE: lineas 1474-1587 (recuadro propio con grid de 4 metricas)
  - Modalidad: lineas 1590-1707 (recuadro propio)
- **Estado deseado:** TODO dentro de UN solo recuadro colapsable. Titulo: "Financiamiento Modalidad 40 Retroactivo". Cada criterio en formato: `TITULO    VALOR` en una sola linea. Titulo en rojo si no cumple. Sin StatusBadge a la derecha.
- **Componentes nuevos necesarios:** Un wrapper colapsable (usar `DetailToggle` o similar) que agrupe todo.
- **Complejidad:** Alta — reestructuracion significativa del layout de validaciones.

### C2. Saldo AFORE: formato horizontal compacto
- **Archivo:** `src/app/page.tsx:1536-1586`
- **Estado actual:** Grid de 4 metricas verticales (Sin trabajar, Requerido, Saldo actual, Faltante).
- **Estado deseado:** Todo en 1-2 lineas horizontales:
  ```
  SALDO AFORE    Requerimiento: $100,000/ano ($274/dia) - 894 sem
  SIN TRABAJAR: 3a 5m 23d    REQUERIDO: $347,397    SALDO ACTUAL: $1,043,110    FALTANTE: $780,889 (rojo)
  ```
- **Complejidad:** Media — reformatear grid a inline.

### C3. Derecho Modalidad 40: compactar en 1-2 lineas
- **Archivo:** `src/app/page.tsx:1608-1618`
- **Estado actual:** Dos `SubCheck` verticales con recuadros propios (Conservacion y 52 Semanas).
- **Estado deseado:** Dos lineas simples:
  ```
  CONSERVACION (MAX 4A 11M 22D)    3a 5m 23d (1268d)     [rojo si no cumple]
  MIN. 52 SEM. COTIZADAS EN 5 ANOS    261 semanas (1827d)  [rojo si no cumple]
  ```
  Si CUALQUIER sub-item rojo -> titulo "Derecho para hacer Modalidad 40" tambien rojo.
- **Complejidad:** Media.

### C4. Conservacion/Sin Cotizar: una linea cada uno
- **Archivo:** `src/app/page.tsx:1885-1898`
- **Estado actual:** Grid de 2 columnas, cada uno con titulo + valor + sub-texto (3 lineas verticales).
- **Estado deseado:** Una sola linea horizontal por concepto:
  ```
  CONSERVACION    4a 3m 11d    223 sem
  SIN COTIZAR    3a 5m 23d    1,268 dias
  ```
- **Complejidad:** Baja.

### C5. Tarjetas de calificacion: criterios en linea unica
- **Estado actual:** Cada criterio usa `SubCheck` (lineas 596-617) que ocupa un recuadro con titulo + "Cumple/No cumple — valor".
- **Estado deseado:** Cada criterio en una sola linea: `LABEL    VALOR` con valor en rojo si no cumple. Sin recuadro individual. Sin texto "Cumple"/"No cumple".
- **Impacto:** Requiere nuevo componente `InlineCheck` o modificar `SubCheck` radicalmente.
- **Complejidad:** Media — afecta TODOS los usos de SubCheck (aprox 15 instancias).

### C6. Semanas Cotizadas: todo en una linea con enlace naranja
- **Archivo:** `src/app/page.tsx:1418-1425`
- **Estado actual:** Titulo "Semanas Cotizadas" + subtexto en linea separada + enlace DetailToggle abajo.
- **Estado deseado:** Todo en UNA linea: `Semanas Cotizadas    Min requerido (810, edad 62a 8m 23d)    [Ver tabla...]` con enlace en naranja.
- **Complejidad:** Baja.

### C7. Seccion AFORE: colapsable, cerrado por defecto
- **Archivo:** `src/app/page.tsx:2039-2069` (Resumen Financiero + Desglose)
- **Estado actual:** Dos secciones separadas, siempre visibles.
- **Estado deseado:** Una sola seccion "AFORE" colapsable (cerrada por defecto). Contenido: saldo AFORE a regresar, SAR 92-97, RCV, Vivienda. Sin promedio salarial ni semanas. Desglose dentro de un sub-desplegable.
- **Complejidad:** Media.

### C8. Promedio Salarial: colapsable
- **Archivo:** `src/app/page.tsx:2071-2082`
- **Estado actual:** Seccion abierta siempre visible.
- **Estado deseado:** Colapsable (cerrado por defecto). Mover a "Informacion del Lead" o dejarlo independiente pero colapsable.
- **Complejidad:** Baja.

### C9. Historial Laboral: colapsable
- **Archivo:** `src/app/page.tsx:2084-2093`
- **Estado actual:** Seccion abierta siempre visible.
- **Estado deseado:** Colapsable (cerrado por defecto). Mover a "Informacion del Lead" o dejarlo independiente pero colapsable.
- **Complejidad:** Baja.

### C10. Art. 151: colapsable
- **Archivo:** `src/app/page.tsx:1900-1930`
- **Estado actual:** Siempre visible cuando `perdioDerechos === true`.
- **Estado deseado:** Contenido visible solo al hacer clic en flecha. Titulo siempre visible.
- **Complejidad:** Baja — envolver en DetailToggle.

### C11. Agrupacion visual: Ahora+Futuro en un recuadro, Recuperar+PensionMinima+500Sem en otro
- **Archivo:** `src/app/page.tsx:1711` (grid actual `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)
- **Estado actual:** 4 tarjetas en grid de 4 columnas iguales.
- **Estado deseado:** Dos grupos visuales:
  - Fila 1: `[Ahora | Futuro]` dentro de un contenedor con borde
  - Fila 2: `[Recuperar Derechos | Act. Pension Minima | Completar 500 Semanas]` dentro de otro contenedor
- **Complejidad:** Media — reestructurar el grid y agregar contenedores wrapper.

### C12. Todo visible en UN pantallazo sin scroll
- **Impacto:** Las 5 tarjetas + validaciones colapsadas deben caber en viewport sin scroll. Requiere que:
  - Tarjetas sean mas compactas (criterios en linea, sin badges)
  - Validaciones sean colapsables (cerradas por defecto)
  - Sin elementos redundantes (subtitulos, banners grandes)
- **Complejidad:** Resultado de aplicar C1-C11. No es un cambio aislado sino una consecuencia.

### C13. Vigencia derechos Mod 40: agregar al lado de Modalidad
- **Archivo:** `src/app/page.tsx:1590-1707`
- **Estado actual:** NO existe. Solo muestra RP y si cumple conservacion/semanas.
- **Estado deseado:** Agregar:
  - `RP: 10` (ultimos 2 digitos, ya cubierto en B8)
  - `Vigencia: 16/02/2031` (fecha verde si vigente, roja si expirada)
  - `Cotizacion en ultimos 5 anos: Ultima cotizacion hace 0a 4m 2d (<= 5 anos)`
- **Datos necesarios:** La fecha de vigencia NO se calcula actualmente. Se necesita: `ultimaCotizacion + diasConservacion` como fecha de expiracion.
- **Complejidad:** Media — calcular fecha de vigencia + agregar UI.

### C14. Seccion "Asesoria" simplificar
- **Archivo:** `src/app/page.tsx:2115-2288`
- **Estado actual:** Tab separado con MetricCards, Mes Pension Pronta, Escenarios.
- **Estado deseado:** "Necesita menos datos y reacomodarse visualmente. Solo interaccion con botones." Esto es vago — se puede diferir o preguntar al cliente.
- **Complejidad:** Baja-Media (depende de clarificacion).

### C15. Separar informacion de recuperacion en dos desplegables
- **Archivo:** `src/app/page.tsx:1900-1947`
- **Estado actual:** Un solo bloque con Art. 151 + rastreabilidad + DetailToggle "Ver calculo de conservacion".
- **Estado deseado:** Dos desplegables separados:
  1. "Ver calculo de conservacion" (info amarilla: semanas requeridas)
  2. "Ver periodo de recuperacion" (info azul: tabla de periodos de cotizacion)
- **Complejidad:** Baja — dividir contenido en dos DetailToggles.

---

## SECCION D: NUEVOS COMPONENTES

### D1. Tarjeta "Completar 500 Semanas" (5ta tarjeta)
- **Estado actual:** NO EXISTE.
- **Estado deseado:** Nueva tarjeta con:
  - Titulo: "Completar 500 Semanas"
  - Criterios:
    - `EDAD MIN. 59    [valor]` (rojo si no cumple)
    - `MIN. 440 SEMANAS    [valor]` (rojo si no cumple)
  - Sin criterio de pension < minima
  - Sin criterio de >= 2 anos sin cotizar
  - Indicador: "Si califica" / "No califica"
- **Logica necesaria:**
  ```typescript
  const comp500CumpleEdad = edad >= 59;
  const comp500CumpleSemanas = semanasTotales >= 440;
  const comp500Acredita = comp500CumpleEdad && comp500CumpleSemanas;
  ```
- **Archivo:** `src/app/page.tsx` — agregar despues de la tarjeta Act. Pension Minima (linea 1861)
- **Complejidad:** Baja — copiar patron de tarjeta existente con criterios nuevos.

### D2. Seccion "Calificacion" (formulario interactivo con preguntas)
- **Estado actual:** NO EXISTE. Solo hay el toggle de Credito INFONAVIT (lineas 1982-2037) y la seccion de retiros-desempleo.
- **Estado deseado:** Nuevo formulario ANTES de los resultados con 6 preguntas:

| # | Pregunta | Estado | UI |
|---|----------|--------|-----|
| 1 | Esta pensionado? | `useState<"no" \| "si-temporal" \| "si-definitivo">` | Botones No(verde) / Si(rojo). Si "Si" -> "Temporal"(verde) / "Definitivo"(rojo) |
| 2 | Necesidad | `useState<boolean>` | "Si necesita"(verde) / "No, solo asesoria"(rojo). Si rojo -> cascada |
| 3 | Simulacion | `useState<"no" \| "si-timbrados" \| "si-no-timbrados">` | No(verde) / Si(rojo). Si "Si" -> Timbrados(verde) / No timbrados(rojo). Si no-timbrados -> cascada |
| 4 | Demandas | `useState<"no" \| "si-conciliacion" \| "si-avanzo">` | No(verde) / Si(rojo). Si "Si" -> Conciliacion(verde) / Ya avanzo(rojo). Si avanzo -> cascada |
| 5 | Credito INFONAVIT | Reusar `tieneCredito`/`montoCredito` existentes | No(verde) / Si(azul). Si "Si" -> campo monto. Monto resta de AFORE |
| 6 | Reintegro semanas | Condicional | Solo si `semanasDescontadas > 0`. Si no -> "no hay". Si si -> tabla retiros + campo manual |

- **Logica cascada:** Si cualquier pregunta descalifica, TODAS las posteriores muestran "No califica" automaticamente.
- **Nuevos estados necesarios:**
  ```typescript
  const [estaPensionado, setEstaPensionado] = useState<"no" | "si-temporal" | "si-definitivo">("no");
  const [necesitaFinanciamiento, setNecesitaFinanciamiento] = useState(true);
  const [simulacion, setSimulacion] = useState<"no" | "si-timbrados" | "si-no-timbrados">("no");
  const [demandas, setDemandas] = useState<"no" | "si-conciliacion" | "si-avanzo">("no");
  const [montoReintegroManual, setMontoReintegroManual] = useState<number | null>(null);
  ```
- **Impacto en calculos:** El resultado de la cascada debe bloquear las tarjetas de calificacion. El monto de reintegro manual debe sumarse al AFORE solo para Ahora/Futuro.
- **Complejidad:** ALTA — nuevo componente complejo con logica de cascada, estados multiples, integracion con calculos.

### D3. Seccion "Informacion del Lead" (consolidacion)
- **Estado actual:** NO EXISTE como seccion unificada. Los datos estan dispersos:
  - Ley 73: lineas 1397-1411
  - Edad: lineas 1226-1235
  - Semanas: header del resultado
  - Promedio salarial: `result.salaryAverage.promedio`
  - Vigencia derechos: NO calculada
  - AFORE desglose: componente AforeBreakdown
  - Periodos laborales: NO existe como seccion separada
  - Historial laboral: componente EmploymentTimeline
- **Estado deseado:** Seccion colapsable con:
  1. Ley 73 (si/no)
  2. Fecha inicio cotizacion (primera alta)
  3. Edad A-M-D (rojo si < 60)
  4. Fecha cumple/cumplio 60 (rojo si futura)
  5. Semanas cotizadas / descontadas / reintegradas
  6. Promedio salarial dia/mes
  7. Derecho Mod 40: vigencia + tiempo A/M/D (rojo si no tiene) + desplegable periodos ventana 5 anos
  8. Derecho a pensionarse: vigencia + tiempo A/M/D (rojo si no tiene) + desplegable recuperacion derechos
  9. A recibir al pensionarse
  10. AFORE: desplegable con SAR/RCV/INFONAVIT
  11. Periodos laborales (desplegable)
  12. Historial laboral (desplegable)
- **Datos ya disponibles:** La mayoria ya se calculan pero estan dispersos. Falta: fecha cumple 60 (`fechaNacimiento + 60 anos`), vigencia derechos Mod 40 (`ultimaCotizacion + conservacion`), vigencia derechos pension (`ultimaCotizacion + conservacion` general).
- **Complejidad:** Alta — nuevo componente grande que consolida datos de multiples fuentes.

### D4. Seccion "Mod. 40 Retroactivo" (condicional, desplegable)
- **Estado actual:** Los escenarios de pension estan en el tab "Asesoria" (lineas 2210-2286). Se muestran siempre para Ley 73.
- **Estado deseado:** Seccion que:
  - Solo aparece si califica para financiamiento
  - Si no califica: oculta, con "v" desplegable
  - Contenido: semanas cot/desc/reint, promedio salarial dia/mes, pension actual, monto total, tiempo retroactivo, pension e incremento, "Ver calculo" desplegable
- **Complejidad:** Media — reubicacion y condicionamiento de contenido existente.

---

## SECCION E: NUEVA LOGICA DE NEGOCIO

### E1. Banner superior con calificacion prioritaria
- **Estado actual:** Banner muestra la primera calificacion que pasa if/else (Ahora > Futuro > Recuperacion > PensionMinima > No acredita).
- **Estado deseado:** Prioridad explicita:
  1. Financiamiento Ahora
  2. Financiamiento Futuro
  3. Recuperacion de Derechos
  4. Actualizacion Pension Minima
  5. Completar 500 Semanas
  - Mostrar: "Califica para [nombre]" o "No califica"
- **Diferencia con actual:** Se agrega "Completar 500 Semanas" como 5ta opcion. La logica ya sigue esta prioridad implicitamente, pero se debe explicitar y agregar la nueva opcion.
- **Impacto:** Agregar `comp500Acredita` al flujo del banner + crear nueva variable de calificacion prioritaria.
- **Complejidad:** Baja.

### E2. Logica cascada de calificaciones
- **Estado actual:** NO EXISTE. Cada calificacion se evalua independientemente.
- **Estado deseado:** Si el formulario de Calificacion (D2) tiene una respuesta descalificante:
  - "No necesita financiamiento" -> TODO es rojo
  - "Simulacion Si + No timbrados" -> TODO es rojo
  - "Demanda Si + Ya avanzo" -> TODO es rojo
- **Logica:**
  ```typescript
  const cascadaDescalifica =
    !necesitaFinanciamiento ||
    simulacion === "si-no-timbrados" ||
    demandas === "si-avanzo";
  ```
  Si `cascadaDescalifica`, forzar todas las tarjetas a "No acredita".
- **Complejidad:** Media — afecta la evaluacion de TODAS las tarjetas.

### E3. Credito INFONAVIT resta saldo AFORE
- **Estado actual:** YA IMPLEMENTADO. Lineas 762-764:
  ```typescript
  const descuentoCredito = tieneCredito ? Math.min(montoCredito, viviendaBruta) : 0;
  const viviendaAjustada = viviendaBruta - descuentoCredito;
  ```
  El saldo AFORE ya se reduce. PERO el toggle esta en una seccion separada (lineas 1982-2037), no en el formulario de calificacion.
- **Estado deseado:** Mover el toggle/input a la pregunta #5 del formulario de Calificacion (D2). La logica de calculo ya es correcta.
- **Complejidad:** Baja — mover UI, logica ya funciona.

### E4. Reintegro de semanas: monto suma a AFORE solo para Ahora/Futuro
- **Estado actual:** La seccion `RetirosDesempleo` (lineas 1954-1971) calcula monto a devolver pero NO afecta el saldo AFORE en los calculos de calificacion.
- **Estado deseado:**
  - El monto de reintegro (calculado o manual) se SUMA al AFORE requerido solo para Financiamiento Ahora y Futuro
  - NO se suma para Recuperacion de Derechos ni Pension Minima ni Completar 500
  - Campo manual para sobrescribir el monto calculado
- **Logica nueva:**
  ```typescript
  const montoReintegro = montoReintegroManual ?? result.retirosDesempleo.totalDevolver;
  // Para Ahora/Futuro: saldoAfore se ajusta
  const saldoAforeParaFinanciamiento = saldoAfore + montoReintegro;
  // Para Recuperacion/PensionMinima/500: usar saldoAfore sin ajuste
  ```
- **Complejidad:** Media — nueva logica de calculo diferenciada por tipo de calificacion.

### E5. Pregunta "Esta pensionado?" con subopciones
- **Estado actual:** NO EXISTE.
- **Estado deseado:** Si "Si definitivo" -> implica ciertas restricciones en la calificacion. El video no detalla completamente las implicaciones de negocio mas alla del UI.
- **Complejidad:** Baja para UI, incierta para logica (falta clarificar impacto exacto en calculos).

### E6. Fecha vigencia derechos Mod 40 y pension
- **Estado actual:** NO SE CALCULA.
- **Estado deseado:** Calcular:
  - Vigencia Mod 40 = `ultimaCotizacion` + `LIMITE_MOD10_DIAS` (si mod10) o `LIMITE_MOD40_DIAS` (si mod40)
  - Vigencia pension = `ultimaCotizacion` + `diasConservacion`
  - Mostrar fecha, verde si vigente, rojo si expirada
- **Datos disponibles:** `ultimaCotizacion` (linea 783), `LIMITE_MOD10_DIAS` (linea 204), `diasConservacion` (linea 822). Solo falta hacer la suma y formatear.
- **Logica:**
  ```typescript
  const vigenciaMod40 = ultimaCotizacion
    ? new Date(ultimaCotizacion.getTime() + (modalidad === "mod40" ? LIMITE_MOD40_DIAS : LIMITE_MOD10_DIAS) * 86400000)
    : null;
  const vigenciaMod40Activa = vigenciaMod40 ? vigenciaMod40.getTime() > Date.now() : false;

  const vigenciaPension = ultimaCotizacion
    ? new Date(ultimaCotizacion.getTime() + diasConservacion * 86400000)
    : null;
  const vigenciaPensionActiva = vigenciaPension ? vigenciaPension.getTime() > Date.now() : false;
  ```
- **Complejidad:** Baja — calculos simples, UI directa.

### E7. Logica "Completar 500 Semanas" — distincion con Pension Minima
- **Estado actual:** Solo existe "Act. Pension Minima".
- **Estado deseado:** Dos tarjetas con criterios diferentes:

  | | Pension Minima | Completar 500 |
  |-|----------------|---------------|
  | Edad min | 59a 8m | 59 |
  | Semanas min | 470 | 440 |
  | >= 2 anos sin cotizar | ELIMINADO | N/A |
  | Pension < minima | Mostrar pero NO bloquea | N/A |
  | Fecha dejo cotizar | Mostrar | N/A |

- **Complejidad:** Baja — logica simple, UI es copia de tarjeta existente.

---

## SECCION F: REESTRUCTURACION DE LAYOUT

### F1. Orden de secciones (nuevo flujo)

**Estado actual (de arriba a abajo):**
1. Header con logo/theme/config
2. Person Info (nombre, NSS, CURP, edad)
3. Tab Navigation (Calculadora / Asesoria) **[ELIMINAR]**
4. Verdict Banner
5. Validaciones (Ley73, Semanas, AFORE, Modalidad) — secciones separadas
6. Tarjetas de calificacion (Ahora, Futuro, Recuperacion, PensionMinima) — grid 4 cols
7. Conservacion de Derechos (Art. 150/151)
8. Retiros por Desempleo
9. Credito INFONAVIT
10. Resumen Financiero (ResultsSummary)
11. Desglose de Cuentas (AforeBreakdown)
12. Promedio Salarial
13. Historial Laboral
14. Footer

**Estado deseado:**
1. Header
2. Person Info
3. **Calificacion (formulario)** **[NUEVO]** — preguntas interactivas
4. **Banner** con calificacion prioritaria (reformateado)
5. **5 tarjetas de calificacion** — Ahora+Futuro (agrupadas) + Recuperar+PensionMinima+500Sem (agrupadas)
6. **Validaciones (colapsable)** — "Financiamiento Modalidad 40 Retroactivo", cerrado por defecto
7. **Conservacion/Derechos** — con vigencias, colapsable
8. **Retiros por Desempleo** (movido a formulario de calificacion como pregunta #6, o mantener separado)
9. **AFORE (colapsable)** — renombrado de "Resumen Financiero"
10. **Informacion del Lead (colapsable)** **[NUEVO]** — consolida datos dispersos
11. **Mod. 40 Retroactivo (condicional)** — solo si califica
12. Footer

- **Impacto:** Requiere reorganizar la seccion `{result && (...)}` (lineas 1193-2290) completamente.
- **Complejidad:** Alta — es el cambio mas grande. Toca casi todo el render.

### F2. Tarjetas en dos filas agrupadas
- **Estado actual:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (linea 1711)
- **Estado deseado:**
  ```
  +----------------------------------+
  |  [   Ahora   ] [   Futuro   ]    |
  +----------------------------------+
  +----------------------------------------------+
  |  [Recuperar] [Pension Min] [Completar 500]   |
  +----------------------------------------------+
  ```
  Cada grupo en un contenedor con borde.
- **Complejidad:** Media.

### F3. Validaciones en un solo recuadro colapsable
- **Estado actual:** 3-4 recuadros separados (Ley73, Semanas, AFORE, Modalidad), cada uno con su `<div className="bg-wv-surface rounded-xl...">`.
- **Estado deseado:** Un solo `<div>` con titulo "Financiamiento Modalidad 40 Retroactivo" que engloba todo. Colapsable, cerrado por defecto.
- **Complejidad:** Media — wrap existente + estado de toggle.

### F4. Mover Credito INFONAVIT al formulario de calificacion
- **Estado actual:** Seccion independiente (lineas 1982-2037).
- **Estado deseado:** Pregunta #5 del formulario de Calificacion (D2).
- **Complejidad:** Baja — mover UI existente.

### F5. Contenido de Asesoria integrado en vista unica
- **Estado actual:** Contenido en `{activeTab === "asesoria" && ...}` (lineas 2115-2288).
- **Estado deseado:** MetricCards, Pension Pronta, y Escenarios integrados en la vista unica:
  - MetricCards -> Parte de "Informacion del Lead" o seccion propia
  - Pension Pronta y Escenarios -> Dentro de "Mod. 40 Retroactivo" (D4)
- **Complejidad:** Media.

---

## DEPENDENCIAS Y ORDEN DE IMPLEMENTACION SUGERIDO

### Fase 1: Cambios rapidos (no rompen nada)
1. B1-B8: Renombrar textos
2. A3-A6: Eliminar subtitulos
3. A7: Eliminar criterio >=2 anos + logica
4. B8: RP solo ultimos 2 digitos
5. D1: Nueva tarjeta "Completar 500 Semanas"
6. E1: Actualizar banner con 5ta opcion

### Fase 2: Reformateo visual
7. A10/C5: Eliminar StatusBadge/SubCheck, nuevo formato inline con colores
8. C1/F3: Validaciones en un solo recuadro colapsable
9. C2: Saldo AFORE horizontal
10. C3: Modalidad compacta
11. C4: Conservacion/Sin Cotizar en linea
12. C7-C9: Secciones colapsables (AFORE, Promedio, Historial)
13. C10/C15: Art. 151 y recuperacion en desplegables
14. C11/F2: Tarjetas agrupadas en dos filas
15. C13: Vigencia derechos

### Fase 3: Nuevos componentes
16. A1: Eliminar tabs, fusionar Asesoria en vista unica (F5)
17. D2: Formulario de Calificacion (+ E2 cascada, E3 INFONAVIT, E4 reintegro, E5 pensionado)
18. D3: Informacion del Lead
19. D4: Mod. 40 Retroactivo condicional
20. F1: Reordenamiento final del layout

---

## ARCHIVOS IMPACTADOS

| Archivo | Tipo de cambio | Lineas afectadas |
|---------|---------------|------------------|
| `src/app/page.tsx` | Reestructuracion masiva | ~1500 de 2294 lineas |
| `src/components/results-summary.tsx` | Eliminar metricas | ~30 lineas |
| `src/components/retiros-desempleo.tsx` | Integrar con formulario | ~100 lineas |
| `src/components/afore-breakdown.tsx` | Mover a desplegable | ~10 lineas |
| `src/components/salary-average-breakdown.tsx` | Mover a desplegable | ~10 lineas |
| `src/components/employment-timeline.tsx` | Mover a desplegable | ~10 lineas |

**Total estimado:** ~1700 lineas de cambios sobre ~3200 lineas de codigo UI existente (53% del codigo UI se modifica).

---

## PREGUNTAS PENDIENTES PARA EL CLIENTE

1. **Pension Minima vs Completar 500:** Son dos tarjetas separadas que coexisten, o Completar 500 reemplaza a Pension Minima en ciertos casos?
2. **"Esta pensionado?":** Si responde "Si, Definitivo", que pasa exactamente con las calificaciones? El video no detalla la logica.
3. **Reintegro de semanas:** El monto manual sobrescribe el calculado SOLO para la sesion, o se persiste?
4. **Asesoria simplificada:** Que datos exactamente se eliminan de la pestana de Asesoria (ahora integrada)?
5. **AFORE real y ahorro a conservar:** Estos campos manuales (que aparecen en el video como "Registro de datos restantes para la pension") se mantienen como estan?
