# Irrealista

Extensión de Chrome para puntuar anuncios de Idealista con criterios personales y hacer visibles riesgos que suelen quedar escondidos en el texto del anuncio.

## Puntos fuertes

- **Puntuación siguiendo tus criterios.** Calcula un score explicable a partir de precio, €/m², superficie, planta, ascensor, exterior, reforma y otras señales. Se puede ordenar desde la barra nativa de Idealista.
- **Distancia a la parada de metro más próxima.** Muestra estación, líneas, metros y minutos reales andando. Por ahora solo es compatible con el Metro de Madrid.
- **Descartes claros.** Señala subastas, compras no hipotecables, inmuebles sin posesión, locales/cambios de uso y anuncios sin cédula de habitabilidad.

<p align="center">
  <img src="docs/screenshots/real-search-hard-filter.jpg" alt="Búsqueda real de Idealista con score, rutas de metro y un anuncio descartado" width="100%">
</p>

La captura corresponde a una búsqueda real. Los anuncios, precios y disponibilidad pueden cambiar.

## Instalar

```bash
npm ci
npm run build
```

En `chrome://extensions`, activa **Modo de desarrollador**, pulsa **Cargar descomprimida** y selecciona `dist/`.

## Configuración

En las opciones de la extensión puedes ajustar los pesos del score y configurar OpenRouteService para calcular las rutas a pie. Las rutas se cachean por anuncio y la clave se guarda únicamente en el almacenamiento local del navegador.

## Desarrollo

```bash
npm test
npx tsc --noEmit
npm run build
```

Irrealista es una ayuda de comparación; confirma siempre la situación registral, urbanística, de habitabilidad y financiación antes de comprar.
