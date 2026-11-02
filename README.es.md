# Esfera

[English](README.md)

Esfera es un editor local experimental de panoramas equirectangulares 2:1. Permite navegar en perspectiva, vista amplia y miniplaneta; pintar o borrar selecciones en máscaras independientes; probar métodos de eliminación locales y colocar sellos esféricos. No sube fotografías ni requiere cuenta. Admite panoramas JPEG, PNG y WebP de hasta 75 megapíxeles. Exporta INSP o DNG desde el programa de la cámara antes de abrirlos; Esfera no los lee directamente.

## Instalación

Requiere macOS, Node.js 22.12 o posterior, npm, Python 3 y las herramientas de línea de comandos de Xcode. La selección de sujetos con Vision necesita macOS 14 o posterior. Los helpers y LaMa se han ejecutado en macOS 15.5; el resto de la aplicación no se ha validado en Windows ni Linux.

```sh
npm ci
npm run setup:python
npm run setup:native
npm start
```

OpenCV se utiliza para el procesamiento guiado y los sellos. LaMa es opcional: `npm run setup:lama` descarga y compila la conversión Core ML publicada. El script comprueba los SHA-256 de sus tres archivos, omite un modelo ya compilado y no sube pesos al repositorio. La descarga ocupa unos 206 MiB y el modelo compilado requiere espacio adicional. Las fuentes y licencias figuran en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). La descarga y compilación desde cero deben comprobarse en el equipo de destino; durante el desarrollo se usó un modelo ya instalado.

## Edición

Abre un panorama, arrastra para mirar, usa la rueda o el pellizco del trackpad para el zoom y selecciona una proyección. Cambiar de proyección conserva la dirección de la vista; el miniplaneta permite arrastrar tanto en horizontal como en vertical. Pinta o borra sobre la máscara activa. Cada máscara tiene activación, método y ajustes propios; haz doble clic sobre su nombre para cambiarlo. La selección de sujetos utiliza instancias de primer plano de Apple Vision en local y puede incluir varios sujetos: revisa y corrige la selección antes de aplicar. Si el helper nativo no está disponible, esta función se deshabilita.

El panel lateral contiene secciones plegables independientes: Máscaras, Eliminación, Sellos e Información. Ajusta los valores con los sliders o escríbelos en los campos numéricos; sal del campo para confirmar el valor. En Sellos puedes añadir un sello, importar una imagen o usar un color sólido, colocarlo en la esfera y ajustar tamaño y encuadre. El control de color admite valores hexadecimales de seis dígitos y el selector del sistema. Aplica la vista previa tras los cambios; la exportación utiliza el último estado aplicado.

Los métodos guiado y LaMa usan una vista rectilínea ajustada a cada máscara. Divide en máscaras las selecciones demasiado amplias o incompatibles. La vista guiada tiene como máximo 1600 píxeles en su lado mayor; LaMa procesa un recorte de 800 × 800, por lo que la región editada puede perder detalle. El visor usa inicialmente una textura de hasta 8192 píxeles de ancho y limitada por la GPU; la vista aplicada puede ser menor. Ninguna ofrece inspección a resolución original de todas las imágenes grandes. Revisa especialmente costuras, polos, bordes de selección y alineación de sellos.

## Exportación y metadatos

La exportación crea otro JPEG con las dimensiones originales, calidad seleccionable entre 1 y 100 y submuestreo 4:4:4. El procesamiento usa PNG sin pérdida intermedia y una sola codificación JPEG final. Sharp copia los metadatos admitidos, incluida la ubicación GPS existente; los colores se convierten a sRGB y la exportación lleva un perfil sRGB en lugar del perfil ICC original. Los colores de gama amplia fuera de sRGB pueden recortarse; revisa el archivo y elimina la ubicación por separado antes de compartirlo si es necesario. La conservación de EXIF, XMP e ICC se ha comprobado con imágenes sintéticas, no con todas las etiquetas propietarias de Insta360 ni todos los visores. No se garantiza interpretar o conservar universalmente metadatos propietarios. Las imágenes grandes pueden exigir mucha memoria y tiempo.

El editor es experimental y no garantiza privacidad ni eliminación correcta de objetos. OCR, matrículas, redacción de caras y vídeo **no están implementados**; consulta [ROADMAP.md](ROADMAP.md). Contribuciones: [CONTRIBUTING.md](CONTRIBUTING.md). El código se publica bajo [MIT](LICENSE); las dependencias conservan sus licencias.

`npm run check` ejecuta comprobaciones sintácticas y pruebas locales. Algunas pruebas usan Python y se omiten si no se ha preparado `.venv`. Los gestos físicos del trackpad, archivos grandes de cámara y flujos específicos de plataforma necesitan comprobación manual adicional.
