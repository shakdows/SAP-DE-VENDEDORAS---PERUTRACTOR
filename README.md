# Panel de Ventas SAP · Repuestos CTP

Dashboard analítico interactivo (estilo SaaS) construido sobre el export de SAP
`Data_02_05_2026_al_25_05_2026`. **Todo el procesamiento ocurre en el navegador** — no
hay backend, base de datos ni llamadas externas (salvo Chart.js por CDN). Esto lo hace
ideal para **GitHub Pages** y **Vercel**.

## 📊 Qué incluye

- **5 KPIs** reactivos: venta total, margen total (con %), costo, documentos (ticket promedio) y clientes activos.
- **7 visualizaciones**: tendencia diaria (venta/margen/transacciones), mix por grupo de cliente, ranking de vendedores (venta vs margen), top líneas/familias, matriz de rentabilidad (burbujas venta × margen %), estacionalidad por día de semana, y tablas de Top 10 clientes / Top 10 SKU.
- **Tabla de detalle** con ordenamiento por columna y paginación (4 693 líneas).
- **7 filtros combinables**: buscador de cliente, vendedor, línea/familia, grupo, tipo de documento y rango de fechas. Los filtros se reflejan en chips que se pueden quitar individualmente y recalculan **todo** el panel en tiempo real.

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
