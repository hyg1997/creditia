# Modificaciones Visuales - Video 18/06/2026
> Extraido del video de 63 minutos "18_06_26 modificaciones Visuales.mp4"

---

## 1. NUEVA SECCION: "Calificacion" (formulario interactivo)

Agregar un formulario de preguntas ANTES de mostrar resultados. Cada pregunta tiene botones con colores condicionales y logica en cascada.

### 1.1 Preguntas de calificacion

| # | Pregunta | Opciones | Colores | Logica |
|---|----------|----------|---------|--------|
| 1 | **Esta pensionado?** | No / Si | Verde / Rojo | Si=Si -> mostrar "Temporal" (verde) / "Definitivo" (rojo) |
| 2 | **Necesidad** | Si, necesita financiamiento / No, solo busca asesoria | Verde / Rojo | Si "No" -> TODAS las demas no califican (cascada) |
| 3 | **Simulacion** | No / Si | Verde / Rojo | Si "Si" -> mostrar "Si estan timbrados" (verde) / "No estan timbrados" (rojo). Si "No estan timbrados" -> cascada, nada califica |
| 4 | **Demandas** | No / Si | Verde / Rojo | Si "Si" -> "Sigue en conciliacion y arbitraje" (verde) / "Ya avanzo la demanda" (rojo). Si "Ya avanzo" -> cascada |
| 5 | **Credito INFONAVIT** | No / Si | Verde / **Azul** | Si "Si" -> campo de monto. Ese monto se resta del saldo AFORE |
| 6 | **Reintegro de semanas** | Condicional | - | Solo aparece si tiene semanas descontadas. Si no -> texto "no hay". Si si -> tabla de retiros + campo manual para sobrescribir monto. Monto de reintegro se suma al AFORE solo para Financiamiento Ahora/Futuro (NO para Recuperacion ni Pension Minima) |

### 1.2 Referencia y VPS (desplegables)
- "REFERENCIA" -> desplegable que muestra ART. 191 y 198 LSS
- "VPS" -> desplegable que muestra definicion tecnica del VPS
- Campo de entrada manual para sobrescribir el monto calculado de reintegro

---

## 2. LAYOUT PRINCIPAL - Reestructuracion completa

### 2.1 Eliminar
- Pestanas "Calculadora" / "Asesoria" en la parte superior -> todo en una sola vista
- Componente "Acredita Financiamiento Futuro" (el banner superior es redundante)
- Subtitulos "Pension inmediata" y "Planeacion a pension"
- Texto "Reingreso via Mod 10" en Recuperacion de Derechos
- Texto "Actualizar al ano vigente" en Act. Pension Minima
- Texto explicito "Cumple" / "No cumple" -> reemplazar con COLOR (rojo=no cumple, negro/verde=cumple)
- "PROMEDIO SALARIAL" y "SEMANAS COTIZADAS" del resumen financiero principal
- Tablas detalladas de "Desglose de Cuentas" (SAR, RCV, INFONAVIT) del resumen principal

### 2.2 Banner superior
- Mostrar la calificacion de mayor prioridad: "Califica para [X]"
- Prioridad: 1) Financiamiento Ahora, 2) Financiamiento Futuro, 3) Recuperacion de Derechos, 4) Act. Pension Minima, 5) Completar 500 Semanas
- Si no califica para ninguna: "No califica"

### 2.3 Orden de secciones (de arriba a abajo)
1. **Banner** con nombre + calificacion prioritaria
2. **5 tarjetas de calificacion** (deben verse en UN solo pantallazo sin scroll):
   - Fila 1: "Ahora" + "Futuro" (agrupadas en un recuadro)
   - Fila 2: "Recuperar Derechos" + "Actualizacion Pension Minima" + "Completar 500 Semanas" (agrupadas)
3. **Validaciones** (colapsable, debajo de las tarjetas)
4. **AFORE** (colapsable)
5. **Informacion del Lead** (colapsable)

---

## 3. TARJETAS DE CALIFICACION - Nuevo formato

### 3.1 "Ahora" (antes "Financiamiento Ahora")
- Titulo: solo "Ahora"
- Formato compacto, cada criterio en UNA linea:
  - `EDAD MIN. 60    62 anos` (rojo si no cumple)
  - `> 12 MESES SIN COTIZAR    3a 5m 23d` (rojo si no cumple)
- Indicador general: checkmark verde "Acredita" o X roja "No acredita"

### 3.2 "Futuro" (antes "Financiamiento Futuro")
- Titulo: solo "Futuro"
- Formato identico a Ahora:
  - `EDAD MIN. 59    62 anos`
  - `> 5 MESES SIN COTIZAR    3a 5m 23d`

### 3.3 "Recuperar Derechos" (antes "Recuperacion de Derechos")
- Titulo: "Recuperar Derechos"
- Criterios en una linea cada uno:
  - `Si tiene derechos de pension` (primer criterio, nuevo)
  - `EDAD MIN. 59    62 anos`
  - `MIN. 430 SEMANAS    894 semanas`
  - `AFORE MIN. $40,000    $1,043,110.97`
- Sin texto "Cumple/No cumple" -> solo color rojo si no cumple
- Indicador: "Acredita" / "No acredita"

### 3.4 "Actualizacion Pension Minima" (antes "Act. Pension Minima")
- Titulo completo: "Actualizacion Pension Minima"
- Criterios:
  - `EDAD MIN. 59a 8m    62a 8m`
  - `MIN. 470 SEMANAS    894 semanas`
  - ~~`>= 2 ANOS SIN COTIZAR`~~ ELIMINADO
  - `PENSION < MINIMA ($10,636.54)    $10,636.54` (rojo si no cumple)
  - Mostrar fecha en la que dejo de cotizar
  - Mostrar tiempo sin cotizar (ej: "3a 5m") como indicador visual

### 3.5 "Completar 500 Semanas" (NUEVA tarjeta)
- Titulo: "Completar 500 Semanas"
- Criterios:
  - `EDAD MIN. 59    62 anos`
  - `MIN. 440 SEMANAS    894 semanas`
- Sin criterio de "Pension < Minima"
- Sin criterio de ">= 2 anos sin cotizar"
- Indicador: "Si califica" / "No califica"

---

## 4. SECCION "Validaciones" - Reformateo

### 4.1 Estructura general
- TODO dentro de UN solo recuadro colapsable
- Titulo del contenedor: "Financiamiento Modalidad 40 Retroactivo"
- Colapsado por defecto

### 4.2 Regimen Ley 73
- Una sola linea
- Si no cumple: texto "Regimen Ley 73" en ROJO
- Eliminar indicador "Cumple" a la derecha

### 4.3 Semanas Cotizadas
- Una sola linea: `Semanas Cotizadas    Minimo requerido (810 (edad: 62a 8m 23d))    [Ver tabla...]`
- El enlace "Ver tabla de semanas por edad" en color naranja claro

### 4.4 Saldo AFORE
- Cambiar etiqueta "Costo" a "Requerimiento"
- Formato horizontal compacto (1-2 lineas):
  - `SALDO AFORE    Requerimiento: $100,000/ano ($274/dia) - 894 sem`
  - `SIN TRABAJAR: 3a 5m 23d    REQUERIDO: $347,397    SALDO ACTUAL: $1,043,110    FALTANTE: $780,889` (faltante en ROJO)
- Si no cumple: texto "Saldo AFORE" en ROJO (sin indicador a la derecha)

### 4.5 Derecho para hacer Modalidad 40
- Compactar en 1-2 lineas:
  - `CONSERVACION (MAX 4A 11M 22D)    3a 5m 23d (1268d)` (rojo si no cumple)
  - `MIN. 52 SEM. COTIZADAS EN 5 ANOS    261 semanas (1827d)` (rojo si no cumple)
- Si cualquier sub-item no cumple -> titulo "Derecho para hacer Modalidad 40" en ROJO
- Agregar vigencia de derechos: mostrar RP (solo ultimos 2 digitos: "10" o "40") + fecha vigencia
  - Fecha verde si vigente, roja si expirada
- Mostrar "Cotizacion en los ultimos 5 anos" con resultado: "Ultima cotizacion hace 0a 4m 2d (<= 5 anos)"

### 4.6 Tabla de calificacion por edad/semanas
Tabla de referencia que se muestra en las validaciones:

| Semanas | Edad |
|---------|------|
| 900 | 60a 0m 0d |
| 875 | 59a 6m 1d |
| 850 | 59a 0m 0d |
| 825 | 58a 6m 1d |
| 800 | 58a 0m 0d |
| 775 | 57a 6m 1d |
| 750 | 57a 0m 0d |

### 4.7 Tabla AFORE por semanas (costo financiamiento)

| Semanas | $/ano a financiar |
|---------|------------------|
| 1,000 | $100,000 |
| 1,200 | $80,000 |
| 1,400 | $70,000 |
| 1,500 | $60,000 |
| 1,700 | $50,000 |

---

## 5. SECCION "AFORE" (antes "Resumen Financiero")

- Renombrar "Resumen Financiero" a "AFORE"
- Todo colapsable (cerrado por defecto)
- Contenido:
  - SALDO AFORE A REGRESAR: $X
  - SAR RETIRO 92-97: $X
  - RCV CESANTIA Y VEJEZ: $X
  - VIVIENDA INFONAVIT: $X
  - Desplegable para desglose SAR / RCV / INFONAVIT
- SIN "Promedio Salarial" ni "Semanas Cotizadas" (se muestran en otra parte)

---

## 6. SECCION "Informacion del Lead" (nueva consolidacion)

Secciona nueva que consolida datos del prospecto:

1. **Ley 73** (indicador si/no)
2. **Fecha de inicio de cotizacion**
3. **Edad: A-M-D** (rojo si < 60 anos)
4. **Fecha en que cumple/cumplio 60 anos** (rojo si es futura)
5. **Semanas cotizadas - descontadas - reintegradas** (los 3 numeros)
6. **Promedio salarial dia/mes** (ambos valores)
7. **Derecho Mod. 40:**
   - Vigencia: fecha + tiempo A/M/D (rojo si no tiene derechos)
   - Desplegable: periodos ventana de 5 anos
8. **Derecho a pensionarse:**
   - Vigencia: fecha + tiempo A/M/D (rojo si no tiene derechos)
   - Desplegable: cuanto tiene que cotizar para recuperar derechos (solo si no tiene derechos)
   - Desplegable: periodos de cotizacion (cuando ha cotizado, cuando ha tenido derechos y cuando no)
9. **A recibir al pensionarse** (monto)
10. **AFORE:** desplegable con desglose SAR - RCV - INFONAVIT
11. **PERIODOS LABORALES** (desplegable con tabla)
12. **HISTORIAL LABORAL** (desplegable con tabla)

---

## 7. SECCIONES COLAPSABLES

Hacer colapsables:
- Validaciones (colapsado por defecto)
- AFORE/Resumen Financiero (colapsado por defecto)
- ART. 151 - Semanas nuevas para recuperar
- Ver calculo de conservacion
- Ver periodo de recuperacion / informacion general
- Promedio Salarial
- Historial Laboral
- Referencia ART. 191/198 LSS (reintegro)
- Definicion de VPS (reintegro)
- Periodos ventana de 5 anos
- Cuanto tiene que cotizar para recuperar derechos

---

## 8. MOD. 40 RETROACTIVO (seccion condicional)

- Solo aparece si califica
- Si no califica: ocultar, pero dejar desplegable con "v"
- Contenido cuando visible:
  - Semanas cotizadas, descontadas, reintegradas
  - Promedio salarial diario / mensual
  - Pension actual - monto total
  - Tiempo retroactivo
  - Promedio salarial
  - Pension e incremento
  - "Ver calculo" (desplegable)

---

## 9. REGLAS DE NEGOCIO

### 9.1 Logica de cascada en calificaciones
Si alguna pregunta descalifica (rojo), TODAS las posteriores no califican:
- "No necesita financiamiento" -> todo rojo
- "Simulacion Si + No timbrados" -> todo rojo
- "Demanda Si + Ya avanzo" -> todo rojo

### 9.2 Credito INFONAVIT
- Monto ingresado se RESTA del saldo AFORE para calculos de financiamiento

### 9.3 Reintegro de semanas
- Monto de reintegro se SUMA al AFORE requerido
- Solo aplica a: Financiamiento Ahora y Financiamiento Futuro
- NO aplica a: Recuperacion de Derechos ni Actualizacion Pension Minima
- Campo manual para sobrescribir monto calculado

### 9.4 Vigencia de derechos
- Mostrar RP (solo ultimos 2 digitos: 10 o 40)
- Fecha de vigencia: verde si vigente, rojo si expirada

---

## 10. PRINCIPIOS GENERALES DE DISENO

1. **Todo en un pantallazo**: Las 5 tarjetas de calificacion deben verse sin scroll
2. **Compacto/Slim**: Cada dato en UNA linea, no dos
3. **Color = estado**: Rojo = no cumple, Verde/Negro = cumple. Sin texto "Cumple/No cumple"
4. **Desplegables**: Informacion detallada oculta por defecto, accesible con clic
5. **Sin redundancia**: No repetir datos en multiples lugares
6. **Una sola vista**: Sin pestanas de navegacion
