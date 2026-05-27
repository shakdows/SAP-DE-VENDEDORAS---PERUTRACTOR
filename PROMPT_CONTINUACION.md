# 📋 Prompt de continuación — Panel de Ventas SAP "Repuestos CTP"

Copia y pega TODO el texto de abajo (desde "Hola Claude") en una ventana de chat nueva
para retomar el proyecto exactamente donde lo dejamos. Adjunta también los archivos
`index.html`, `app.js` y `data.js` cuando lo pegues, para que Claude tenga el código actual.

---

Hola Claude. Estoy continuando un proyecto que venía desarrollando. Te paso TODO el contexto
para que sigamos sin empezar de cero. Te adjunto los archivos `index.html`, `app.js` y `data.js`.

## Quién soy
Soy **Alexis Ramírez**, alias **Shakdows**. El dashboard es de mi autoría y lleva mi crédito;
mantén siempre la atribución "Creado por Alexis Ramírez · alias Shakdows" en el footer, el
subtítulo del header y los comentarios de cabecera de `index.html` y `app.js`.

## Qué es el proyecto
Un **dashboard analítico de ventas tipo SaaS**, 100% client-side (HTML + CSS + JavaScript
vanilla + Chart.js por CDN), pensado para desplegarse en **GitHub Pages y Vercel** como sitio
estático. Analiza un export de SAP de una distribuidora de **repuestos de maquinaria pesada
(tipo Caterpillar) en Ucayali, Perú** ("Repuestos CTP").

## Los datos
- Export SAP, pestaña "Data", ~4.693 líneas, periodo 02–25 mayo 2026.
- Columnas: Nombre Vendedor, Key Vendedor, Documento, N° Documento, Nombre de cliente,
  Grupo de cliente, Fecha de venta, SKU vendido, Descripción SKU, Linea/Familia, Cantidad,
  Precio Unitario (US$), Costo Unitario (US$), Margen Unitario (US$), Total Venta (US$),
  Total Costo (US$), Margen Total (US$), %.
- En `data.js` se guardan como `window.SAP_DATA`, un array de objetos con claves cortas:
  `v` (vendedor), `k` (key vendedor), `doc` ('FB' factura/boleta o 'NC' nota de crédito),
  `nd` (n° documento), `cl` (cliente), `g` (1=local final, 2=revendedor), `f` (fecha YYYY-MM-DD),
  `sku`, `d` (descripción), `lf` (línea/familia), `q` (cantidad), `tv` (total venta),
  `tc` (total costo), `m` (margen total).
- Totales de referencia: venta US$ 306.110, margen US$ 90.975 (29,7%), 1.051 documentos,
  466 clientes. Vendedora top: Marisol Soaña (MSL, ~37% de la venta).

## Arquitectura de archivos
- `index.html` — estructura + todo el CSS (tema claro SaaS, alto contraste WCAG, acento ámbar
  de marca CTP). Fuentes: Archivo (display), Manrope (texto), Spline Sans Mono (cifras).
- `app.js` — toda la lógica.
- `data.js` — dataset embebido como respaldo (`window.SAP_DATA = [...]`).
- `vercel.json`, `README.md`, `.gitignore` — despliegue y docs.

## Funcionalidades ya implementadas (NO rehacer, ya funcionan)
1. **5 KPIs** reactivos: venta, margen (con %), costo, documentos (ticket prom.), clientes activos.
2. **Analista automático**: motor de reglas (NO un LLM en vivo) que genera lecturas no obvias:
   concentración por vendedor, Pareto de clientes, cliente top, clientes con margen negativo,
   familia más/menos rentable, mejor día, notas de crédito. **Cada tarjeta es clicable** y abre
   una **ventana flotante (modal)** con detalle estadístico (cuadros + gráfico + tabla). Tipos
   de modal: `ven`, `pareto`, `cli`, `loss`, `fam`, `day`, `nc` (función `openInsight` y objeto
   `DETAIL` en app.js).
3. **8 visualizaciones** (Chart.js): tendencia con granularidad Día/Semana/Mes, venta acumulada,
   mapa de calor diario (CSS grid propio, no Chart.js), mix por grupo (dónut), vendedores con
   doble eje (venta + margen + línea de margen %), top líneas/familias, matriz de rentabilidad
   (burbujas venta × margen %), estacionalidad por día de semana.
4. **Comparador de periodos A vs B**: dos rangos de fecha, KPIs con delta %, gráfico A vs B por
   familia. Respeta los demás filtros.
5. **7 filtros combinables**: cliente (texto), vendedor, línea/familia, grupo, tipo documento,
   rango de fechas; con chips removibles. Recalculan todo el panel.
6. **Exportar CSV** de los datos filtrados (BOM UTF-8, abre en Excel).
7. **Leyendas "¿cómo leer?"** (botón ⓘ) en cada gráfico interpretable.
8. **Tabla de detalle** ordenable y paginada (14 por página).
9. **Carga en vivo desde Google Sheets**: al abrir, pinta con `data.js` y luego intenta leer en
   vivo la pestaña `Data` del Sheet vía endpoint gviz JSON
   (`https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:json&sheet=Data`).
   Si falla (Sheet no público / CORS / offline), usa el respaldo local y lo indica en el header
   ("En vivo · N reg · fecha" en verde vs "Datos locales" en gris). Botón ↻ para refrescar.
   - `SHEET_ID = '1scUhyHY0BxcC4kQyhZScSMq0vPcWFy1iSTW_vJ-BkWI'`, `SHEET_TAB = 'Data'` (en app.js).
   - Requiere que el Sheet esté compartido como "Cualquiera con el enlace: Lector".
   - Funciones clave: `loadLive()`, `transformSheet()`, `parseGvizDate()`, `buildSelectors()`,
     `buildCompare()`.
10. **Crédito de autoría** (Alexis Ramírez / Shakdows) en footer, header y comentarios de código.

## Detalles técnicos a recordar
- Tema CLARO tipo SaaS. Acento ámbar #f59e0b (marca CTP), verde #10b981 (margen/positivo),
  azul #3b6ef5, violeta #7c5cfc, rosa #f43f5e (negativo). Todo el texto cumple contraste ≥4.5:1.
- Sin librerías de framework: JS vanilla. Chart.js 4.4.1 por CDN. Sin localStorage.
- Formateadores: `fUSD`, `fUSD2`, `fNum`, `fPct`, `fAx` (eje adaptativo). Estado global en `ST`.
- El render principal es `render()`; los datos filtrados salen de `applyFilters()`.

## Cosas que YA hablamos y conviene tener presente
- Una "IA en vivo" real (LLM) NO se puede meter en un sitio estático sin exponer una API key;
  por eso el analista es un motor de reglas. Si se quiere LLM real, haría falta una función
  serverless en Vercel con la key en variable de entorno.
- Privacidad: el `data.js` y el Sheet público dejan ver datos de clientes y márgenes. Opción más
  segura para el Sheet: "Publicar en la web → solo pestaña Data → CSV".

## Posibles próximos pasos (pendientes, por si seguimos)
- Hacer clicables también los gráficos (clic en barra de vendedor / celda del mapa de calor → modal).
- Botón "Exportar este detalle a CSV" dentro de cada modal.
- Exportar a .xlsx real (con SheetJS) en vez de CSV.
- Comparador que compare dos vendedores o dos familias (no solo dos fechas).
- Variante de lectura del Sheet por "Publicar en la web" (CSV) para evitar cualquier CORS.
- Login simple / protección, o anonimizar nombres de clientes.

Por favor confirma que tienes el contexto y dime en qué seguimos. Si te pido cambios, edita los
archivos que te adjunté y mantén intactas las funciones ya descritas y el crédito de autoría.
