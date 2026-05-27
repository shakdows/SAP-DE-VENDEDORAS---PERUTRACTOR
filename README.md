# Panel de Ventas SAP · Repuestos CTP

Dashboard analítico interactivo (estilo SaaS) construido sobre el export de SAP
`Data_02_05_2026_al_25_05_2026`. **Todo el procesamiento ocurre en el navegador** — no
hay backend, base de datos ni llamadas externas (salvo Chart.js por CDN). Esto lo hace
ideal para **GitHub Pages** y **Vercel**.

## 🔄 Datos en vivo desde Google Sheets

El panel intenta leer **en vivo** la pestaña `Data` de este Google Sheet cada vez que se abre,
y se refresca también con el botón ↻ del encabezado. Así el dashboard se actualiza solo a
medida que agregas filas al Sheet (diariamente). Si el Sheet no es accesible, usa el
`data.js` incluido como **respaldo** y lo indica en el encabezado.

Sheet conectado: `1scUhyHY0BxcC4kQyhZScSMq0vPcWFy1iSTW_vJ-BkWI` (pestaña `Data`).

### ⚠️ Paso obligatorio para que funcione en vivo
Un sitio estático lee el Sheet desde el navegador del visitante, así que **el Sheet debe ser
público de lectura**:

1. Abre el Google Sheet → botón **Compartir**.
2. En "Acceso general", elige **"Cualquier persona con el enlace"** → rol **Lector**.
3. Listo. Al abrir el panel verás en el encabezado **"En vivo · N reg · fecha"** (verde).

> Si lo dejas privado, el panel seguirá funcionando pero con los datos locales de respaldo
> (verás "Datos locales" en gris). Nadie podrá leer el Sheet en vivo.

### Requisitos del Sheet
- Debe conservar la pestaña **`Data`** con las mismas columnas del export SAP
  (Nombre Vendedor, Key Vendedor, Documento, … , Margen Total (US$), %).
- Las fechas pueden estar como fecha real o texto `D/M/AAAA`; ambas se interpretan.
- Las notas de crédito (Documento = "Nota de Crédito") se detectan y restan solos.

### Cambiar de Sheet
Edita en `app.js` la constante `SHEET_ID` (y `SHEET_TAB` si la pestaña tiene otro nombre).

### Si el navegador bloquea la lectura (CORS)
En algunos casos el método en vivo puede ser bloqueado. Alternativa robusta: en el Sheet,
**Archivo → Compartir → Publicar en la web → pestaña `Data` → CSV**, y se adapta el panel
para leer esa URL publicada. (Avísame y te dejo esa variante.)

## 📊 Qué incluye

- **5 KPIs** reactivos: venta total, margen total (con %), costo, documentos (ticket promedio) y clientes activos.
- **Analista automático**: motor de reglas que lee los datos filtrados y genera lecturas no obvias (concentración de riesgo por vendedor, Pareto de clientes, clientes con margen negativo, familia más/menos rentable, mejor día, impacto de notas de crédito). Se recalcula con cada filtro. *No es un LLM en vivo* — son heurísticas que corren 100% en el navegador, sin clave ni backend.
- **Comparador de periodos A vs B**: define dos rangos de fecha y compara venta, margen, margen %, documentos y ticket promedio con su delta %, más un gráfico A vs B por familia. Respeta los demás filtros.
- **Exportar CSV**: descarga los datos actualmente filtrados (con BOM UTF-8, abre directo en Excel).
- **8 visualizaciones**: tendencia con granularidad Día/Semana/Mes, venta acumulada, mapa de calor diario, mix por grupo, vendedores con doble eje (venta + margen + línea de margen %), top líneas/familias, matriz de rentabilidad (burbujas venta × margen %), estacionalidad por día de semana, y tablas Top 10 clientes / Top 10 SKU.
- **Leyenda "¿cómo leer?"** (botón ⓘ) en cada gráfico interpretable.
- **Tabla de detalle** con ordenamiento por columna y paginación (4 693 líneas).
- **7 filtros combinables**: buscador de cliente, vendedor, línea/familia, grupo, tipo de documento y rango de fechas, reflejados en chips removibles.

## 📁 Estructura

```
index.html   → estructura + estilos
app.js       → lógica (filtros, KPIs, gráficos, tablas)
data.js      → dataset (window.SAP_DATA, 4 693 registros)
vercel.json  → config de despliegue estático
```

## 🚀 Despliegue

### Opción A · GitHub Pages
1. Crea un repo y sube estos 4 archivos a la raíz.
2. *Settings → Pages → Source: `main` / root.*
3. Tu panel queda en `https://<usuario>.github.io/<repo>/`.

### Opción B · Vercel (recomendado)
1. Sube el repo a GitHub.
2. En [vercel.com](https://vercel.com) → *Add New → Project* → importa el repo.
3. Framework preset: **Other** (es estático, sin build). Deploy.

> 💡 Ejecución local: abre `index.html` directamente en el navegador. Como los datos
> viven en `data.js` (no se cargan por `fetch`), funciona sin servidor.

> ⏱️ **Sobre las vistas Semana/Mes**: este export cubre solo del 2 al 25 de mayo de 2026
> (~3.5 semanas de un mes). Por eso la vista "Mes" muestra un solo bloque. El selector de
> granularidad ya está implementado: si cargas un `data.js` con un rango mayor (varios meses
> o un año), las vistas Semana/Mes se llenarán automáticamente.

## 🔎 Hallazgos clave del periodo (2–25 mayo 2026)

| Indicador | Valor |
|---|---|
| Venta total | **US$ 306,110** |
| Margen total | **US$ 90,975** (29.7%) |
| Documentos | 1,051 · ticket promedio US$ 291 |
| Clientes activos | 466 |
| Líneas vendidas | 4,693 · 29,009 unidades |

- **Concentración en vendedores**: MARISOL SOAÑA (MSL) genera el **37%** de la venta (US$ 113k).
- **Familias top por venta**: Empaques (US$ 33k), Carriles/Rodillos (US$ 27k) y Cadenas (US$ 25k).
- **Margen vs volumen**: Pernos rinde el **mejor margen (43%)** entre familias grandes; Carriles/Rodillos vende mucho pero con margen bajo (15%).
- **Cliente top**: NEGOCIACIÓN MADERERA TRAVI SATIPO (US$ 32.7k, ~11% de la venta).
- **Mix**: 54% cliente local final / 46% revendedor; el revendedor entrega margen % similar pese a menor venta.
- 21 notas de crédito (US$ −1,351) ya están netas en los totales.

---
Generado automáticamente. El procesamiento es 100% client-side.
