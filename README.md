# Esfera: prototipo local

Editor de panoramas equirectangulares JPEG/PNG/WebP 2:1, hasta 75 MP. La Insta360 X5 produce hasta 11.904 × 5.952: exporta primero el panorama 360 desde Insta360 Studio. INSP y DNG no se abren directamente.

## Inicio

Requiere Node.js y dependencias instaladas: `npm install` y `npm start`. Abre una imagen, gira la vista, selecciona «Pintar selección», pinta sobre la persona y exporta. El original no se sobrescribe. La vista previa se reduce a 4096 × 2048; la exportación conserva las dimensiones originales y aplica el difuminado con Sharp.

## Alcance y límites

El efecto local difumina, no reconstruye el fondo; su fuerza depende del tamaño del sujeto. Comprueba visualmente que la persona quede suficientemente irreconocible. La máscara se dibuja sobre la esfera con resolución reducida, con lo que sus bordes pueden ser menos precisos en la imagen final. Los polos y las zonas que cruzan la costura necesitan revisión. El proceso a 72 MP requiere bastante memoria. La salida JPEG es una imagen equirectangular; la conservación de metadatos 360 y su reconocimiento en cada visor deben comprobarse con archivos reales.

La selección automática de personas aún no está implementada. Los métodos disponibles se ejecutan localmente.

## Perspectiva y líneas (experimental)

Requiere Python 3 y OpenCV en `.venv`: `python3 -m venv .venv` y `.venv/bin/pip install opencv-python-headless`. Centra toda la selección en la vista dejando margen. Al aplicar, se proyecta la panorámica a una vista 2D, se detectan segmentos con OpenCV y se combinan las direcciones de los dos segmentos cercanos. Para cada zona se interpola en una dirección aproximada; si no hay líneas cercanas, se usa dirección horizontal en la vista. El resultado se reproyecta a la panorámica. El mensaje indica cuántas líneas se detectaron.

Esta es una aproximación: todavía no construye ni muestra pares de guías o regiones con una homografía independiente. Las líneas elegidas pueden ser ajenas al fondo oculto. El relleno se calcula sobre una vista de 1600 píxeles de ancho, también al exportar a resolución original; por tanto, la zona editada pierde detalle. No se ha validado con 72 MP ni con fotografías reales; revisa el resultado y la compatibilidad 360 antes de utilizarlo.

La exportación copia EXIF, XMP, IPTC y perfiles ICC disponibles desde el original mediante Sharp. Se ha comprobado con una imagen sintética que conserva el modelo EXIF y los campos XMP GPano ensayados; sigue pendiente comprobar archivos reales de Insta360 y su reconocimiento en visores 360. Las exportaciones anteriores a este cambio podían perder los metadatos originales.

«Cerrar imagen» descarta la selección y la vista previa; pide confirmación si existe una selección. Deshacer permite recuperar trazos de selección y una limpieza, pero no revierte un archivo exportado.

## Eliminación con IA local

El método «Eliminar con IA local (LaMa)» utiliza Core ML en el Mac, sin subir fotografías. Pinta completamente el objeto, incluida su silueta y sombra; encuadra toda la selección con espacio alrededor y pulsa Aplicar y previsualizar. El modelo es LaMa, no el borrador de Apple Fotos. Trabaja sobre un recorte cuadrado de 800 × 800 extraído de una vista 2D de 1600 píxeles de ancho y reproyecta la zona editada a la panorámica. La salida mantiene las dimensiones del original, pero la zona regenerada puede perder detalle. Una máscara excesivamente grande puede producir un resultado poco preciso. La exportación vuelve a ejecutar el modelo con los ajustes aplicados.

Instalación actual: Apple Silicon, macOS 15.5, OpenCV en `.venv`, ejecutable `native/lama-runner` y modelo compilado `models/LaMa.mlmodelc`. Para reinstalar el modelo, descarga los tres archivos de `LaMa.mlpackage` desde `https://huggingface.co/mlboydaisuke/LaMa-CoreML/tree/main/LaMa.mlpackage`, compila con `xcrun coremlcompiler compile models/LaMa.mlpackage models` y construye el ejecutable con `xcrun swiftc -O native/LaMaRunner.swift -o native/lama-runner`. El paquete de pesos descargado ocupa aproximadamente 206 MiB; la versión compilada ocupa otros 207 MiB. No se versionan los pesos ni el ejecutable. LaMa: Apache 2.0; conversión de Core ML: https://github.com/mallman/CoreMLaMa; parte de la conversión de píxeles se adapta de https://github.com/Dunebru/erase bajo MIT, cuya licencia se incluye en `native/ERASE-MIT-LICENSE.txt`.

## Calidad de exportación

La vista previa se comprime únicamente para visualizarla. El resultado de la edición se procesa con intermediarios PNG, sin compresión JPEG intermedia. Al exportar se elige la calidad JPEG entre 1 y 100 (100 por defecto). Se realiza una única codificación final con pérdida y color 4:4:4. Se conservan las dimensiones y se copian los metadatos admitidos del original. Una calidad más alta puede producir archivos mayores; ningún valor recupera información que ya se perdió en el JPEG original.

La IA procesa un recorte a 800 × 800, extraído de una vista de 1600 píxeles: solo la región editada tiene esa limitación de detalle. El flujo a 72 MP puede requerir mucha memoria y no se ha probado a esa resolución.
