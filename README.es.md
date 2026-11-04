[🇬🇧 English](README.md) · [🇪🇸 Español](README.es.md)

# Borra personas y objetos de panoramas con IA local en tu MacBook

**Esfera es una aplicación gratuita y de código abierto para eliminar personas y objetos de fotografías 360°.**

Bórrate de un panorama, elimina a un transeúnte o quita un objeto que distrae. Esfera utiliza IA local para reconstruir el fondo, con resultados que pueden ser casi imperceptibles según la escena y la selección.

Tus fotos se quedan en tu equipo. No necesitas cuenta, suscripción ni pagar por servicios de IA en la nube. El modelo compacto LaMa se ejecuta en un MacBook sin necesitar una estación de trabajo de alta gama ni una GPU externa.

## Qué puedes hacer

- **Borrar con IA local.** Pinta sobre un objeto y deja que LaMa reconstruya el fondo.
- **Elegir otros algoritmos de borrado.** Prueba el relleno guiado por perspectiva, el estiramiento de bordes, la copia de fondo cercano o el difuminado según la escena.
- **Editar directamente en 360°.** Mira alrededor del panorama y selecciona objetos sobre una vista en perspectiva natural.
- **Seleccionar sujetos automáticamente.** Utiliza la selección local de primer plano y corrígela a mano.
- **Cubrir un trípode o añadir un logotipo.** Coloca imágenes o sellos de color en cualquier punto de la esfera.
- **Exportar un JPEG a tamaño original.** Elige la calidad y conserva los metadatos de origen compatibles.

La interfaz está disponible en español e inglés.

## Requisitos y plataformas

La base de Esfera —Electron, Three.js, Node.js, Sharp y Python/OpenCV— es multiplataforma y está diseñada para admitir otros sistemas operativos. **Por ahora, Esfera solo se ha probado en macOS.**

Las integraciones actuales de IA local y selección automática usan Core ML y Vision de Apple. Estas funciones necesitan alternativas para Windows y Linux; esas plataformas todavía no son destinos compatibles listos para usar.

Para ejecutar la versión actual de macOS desde el código fuente necesitas:

- Node.js 22.12 o posterior y npm.
- Python 3.
- Las herramientas de línea de comandos de Xcode.

La selección automática de sujetos requiere macOS 14 o posterior. El desarrollo y las pruebas se han realizado en macOS 15.5.

## Descargar la aplicación

Descarga la **versión preliminar para macOS Apple Silicon** en [GitHub Releases](https://github.com/Eseperio/esfera-editor/releases/tag/v0.2.0-preview.1). Incluye su entorno de ejecución: para usar la app descargada no hace falta instalar Node.js, Python ni Xcode.

1. Descarga y descomprime el ZIP; mueve **Esfera.app** a Aplicaciones.
2. Abre Esfera y pulsa **IA local → Instalar modelo**. El modelo se descarga una vez; tus fotos permanecen en tu equipo.
3. Abre un panorama y empieza a editar.

Esta versión requiere macOS 14 o posterior y un Mac con Apple Silicon. Tiene firma ad hoc, **sin notarización de Apple**, por lo que macOS puede pedir autorización en Privacidad y seguridad al abrirla por primera vez. Todavía no se ofrecen paquetes para Intel, Windows ni Linux.

## Ejecutar desde el código fuente

```sh
git clone https://github.com/Eseperio/esfera-editor.git
cd esfera-editor
npm ci
npm run setup:python
npm run setup:native
npm run setup:lama
npm start
```

También puedes instalar el modelo desde el botón **IA local** de la aplicación. La descarga de LaMa ocupa unos **206 MiB** y el modelo se compila en tu equipo, para lo que se necesita espacio adicional. El instalador verifica los archivos y reutiliza un modelo ya compilado.

Puedes omitir `npm run setup:lama` y utilizar los demás algoritmos sin IA. Las fuentes y licencias del modelo figuran en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Borrar tu primer objeto

1. Abre un panorama y mira hacia la persona u objeto que quieras borrar.
2. Pinta encima o utiliza la selección automática de sujetos y corrige el resultado.
3. Elige **Eliminar con IA local** u otro método de relleno.
4. Pulsa **Aplicar** y revisa el resultado. Ajusta la selección si hace falta.
5. **Exporta** el JPEG con la calidad que elijas.

Vuelve a aplicar después de cambiar algo: la exportación guarda el último resultado aplicado.

## Imágenes compatibles y exportación

|           | Compatibilidad                                                            |
| --------- | ------------------------------------------------------------------------- |
| Entrada   | Panoramas equirectangulares 2:1 en JPEG, PNG o WebP, hasta 75 megapíxeles |
| Salida    | JPEG con las dimensiones originales y calidad seleccionable de 1 a 100    |
| Metadatos | Se copian los metadatos compatibles, incluido el GPS existente            |
| Color     | Exportación en sRGB                                                       |

Para archivos Insta360 INSP o DNG, exporta primero un panorama compatible desde el programa de la cámara.

El procesamiento utiliza archivos intermedios sin pérdida y una sola codificación JPEG final. La IA local trabaja con un recorte de 800 × 800, por lo que las zonas reconstruidas pueden perder detalle fino aunque la exportación conserve las dimensiones originales. El resultado depende del fondo y del tamaño de la selección.

Consulta las [notas de validación](docs/VALIDATION.md) para conocer otros límites del procesamiento, el tratamiento del color y la compatibilidad de metadatos.

## Hoja de ruta

Están previstas la detección local de textos, caras y matrículas, herramientas específicas de difuminado y pixelado, y soporte para vídeo 360°. Consulta [ROADMAP.md](ROADMAP.md).

Esfera es experimental. Son bienvenidos los comentarios y ejemplos que ayuden a mejorar la calidad del borrado.

## Contribuir

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para contribuir y [AGENTS.md](AGENTS.md) para las pautas de desarrollo.

Tras preparar las dependencias, ejecuta las comprobaciones locales:

```sh
npm run check
```

## Licencia

El código propio de Esfera es software libre bajo la [licencia MIT](LICENSE). Las bibliotecas y los componentes del modelo conservan sus respectivas licencias; consulta [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
