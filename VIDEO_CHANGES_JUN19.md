# Cambios Solicitados - Videos WhatsApp 19/06/2026

## Resumen de Videos
- **Video 1**: Bug en Retiros por Desempleo (semanas no cuadran) + pregunta sobre "Monto total retiros"
- **Video 2**: VPS debería variar por año, no ser el mismo para todos los retiros
- **Video 3**: Mockup en Canva mostrando diseño deseado de Calificación + Retiros
- **Video 4**: Sección "Fin. Mod. 40 Retroactivo" — compactar, alinear izquierda, quitar texto largo
- **Video 5**: Layout general — reordenar secciones, hacer tarjetas más slim, renombrar

---

## BUGS / PREGUNTAS FUNCIONALES

### B1. Retiros por Desempleo — semanas no cuadran (Video 1, 0:45-0:59)
- **Problema**: Con el usuario VALENCIA RAMIREZ WENCESLAO CARLOS, al seleccionar todas las casillas la suma da 184 semanas asignadas pero la constancia dice 204. Quedan 20 semanas sin asignar.
- **Acción**: Revisar lógica de asignación de semanas en Retiros por Desempleo

### B2. VPS debería variar por año (Video 2, 0:00-0:20)
- **Problema**: La columna VPS en la tabla de Retiros muestra el mismo valor ($251.18) para todos los años (2005, 2010, 2022). El cliente dice que debería ser diferente para cada año ya que cada retiro tiene diferente monto y semanas.
- **Pregunta**: ¿El VPS reintegro debería calcularse por retiro individual (monto_retiro / sem_descontadas_de_ese_retiro) en vez de global?

---

## CAMBIOS VISUALES / LAYOUT

### V1. Sección Calificación debe ser colapsable (Video 3, 0:35-0:43)
- El cliente quiere que toda la sección "Calificación" tenga un toggle para ocultar/mostrar
- Actualmente siempre se muestra

### V2. Falta pregunta "Simulación" en Calificación (Video 3, 0:48-1:11)
- El cliente dice que falta la pregunta de "Simulación" en la sección de Calificación
- Opciones: No / Sí → Si "Sí": "Sí están timbrados" (verde) / "No están timbrados" (rojo)
- Debe ir ARRIBA de "¿Tiene una demanda activa?"
- **NOTA**: Ya la implementamos en la sesión anterior. Verificar que esté presente.

### V3. Campo de Reintegro: siempre obligatorio a registrar (Video 3, 1:47-2:29)
- El campo "Monto a reintegrar" debe ser SIEMPRE obligatorio de llenar (no opcional)
- El valor calculado automáticamente (Total a devolver) es solo de apoyo/referencia
- El usuario SIEMPRE debe escribir manualmente el monto
- **Cambio**: El campo debe ser un input obligatorio, pre-llenado con el cálculo pero editable

### V4. Referencia Art. 191/198 debe ser desplegable (Video 3, 3:15-3:25)
- La sección "REFERENCIA - ART. 191 Y 198 LSS" con las métricas (VPS reintegro, VPS actual, etc.) debe estar dentro de un desplegable
- Solo se ve al hacer clic

### V5. Sección "Fin. Mod. 40 Retroactivo" — Ley 73 simplificar (Video 4, 0:20-1:00)
- Donde dice "Régimen Ley 73", cambiar a solo "Ley 73"
- Quitar el texto largo de la derecha ("Primera alta antes del 1 julio 1997 - 01/02/1985")
- Solo poner: "Ley 73 inició 01/02/1998"
- **TODO a la izquierda**: Los valores/respuestas que están a la derecha deben pegarse a la izquierda, no separados

### V6. Semanas Cotizadas en Mod 40 Retroactivo — compactar (Video 4, 1:05-1:55)
- Formato: "Semanas Cotizadas 1,044 / 810 mínimo"
- Quitar el enlace "Ver tabla de semanas por edad" como texto
- En su lugar poner una flechita (icono) junto al dato
- Al hacer clic en la flechita, se despliega la tabla de semanas por edad

### V7. Saldo AFORE en Mod 40 Retroactivo — compactar (Video 4, 2:00-3:15)
- Mostrar solo: "Saldo AFORE [monto]" con flechita desplegable
- Quitar "Sin trabajar", "Requerido", etc. del encabezado
- Al hacer clic en la flechita se muestra la tabla de costos y cálculo
- Quitar el enlace "Ver tabla de costos y cálculo del monto requerido"
- Quitar el texto "Requerimiento: $100,000/año ($274/día) - 894 sem" de la derecha

### V8. Alinear todo a la izquierda (Video 4, 0:30-0:50 / Video 5, 1:23-1:59)
- En toda la sección de validaciones/Mod40 Retroactivo: los valores que están alineados a la derecha deben moverse a la izquierda, pegados a su etiqueta
- Ejemplo: en vez de "EDAD MIN. 59 ............... 62 años" → "EDAD MIN. 59  62 años" (todo junto a la izquierda)
- Aplica también a las 3 tarjetas de la derecha (Recuperar Derechos, Act. Pensión Mínima, Completar 500 Semanas)

### V9. Tarjetas más slim (Video 5, 1:18-1:23)
- Las 3 tarjetas de la fila 2 (Recuperar Derechos, Act. Pensión Mínima, Completar 500 Semanas) deben ser más estrechas/compactas
- Reducir padding y espaciado vertical

### V10. Derecho Mod. 40 — mostrar criterios con diferenciador visual (Video 5, 0:23-0:48)
- Conservación y la respuesta, Min. 52 sem en 5 años y la respuesta
- Necesita un diferenciador visual entre criterio y respuesta
- Sugerencia: cambio de color o subrayado para distinguir la respuesta del criterio

### V11. No usar amarillo — solo verde o rojo (Video 5, 1:00-1:11)
- El banner/tarjetas NO deben usar amarillo
- Solo verde (acredita) o rojo (no acredita)
- Si califica → verde, si no → rojo

### V12. Información del Lead — mover arriba (Video 5, 2:16-2:30)
- "Información del Lead" debe ir ARRIBA de "Promedio Salarial" e "Historial Laboral"
- Orden: Información del Lead → Promedio Salarial → Historial Laboral

### V13. Información del Lead — alinear izquierda (Video 5, 2:30-2:51)
- Los valores en Información del Lead deben estar alineados a la izquierda
- Que se vea como el formato de la sección de Calificación (más legible)

### V14. Renombrar "Mod. 40 Retroactivo" → "Datos de Venta" (Video 5, 3:19-3:34)
- El título "Modalidad 40 Retroactivo" debe cambiarse a "Datos de Venta"
- El formato del texto dentro debe ser como el de Calificación (alineado, legible)

### V15. Promedio Salarial e Historial Laboral al final (Video 5, 3:08-3:19)
- Estas dos secciones deben ir hasta abajo, después de "Datos de Venta" (antes Mod 40 Retroactivo)

### V16. Orden general de secciones (Video 5, consolidado)
1. Banner con nombre + calificación
2. Calificación (colapsable)
3. 5 tarjetas de calificación
4. Validaciones (colapsable) — ahora "Fin. Mod. 40 Retroactivo"
5. AFORE
6. Información del Lead
7. Datos de Venta (antes "Mod 40 Retroactivo")
8. Promedio Salarial
9. Historial Laboral
10. Retiros por Desempleo
