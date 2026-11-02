# Esfera: plan de implementación de la estación de edición

Fecha: 2026-11-02. Responsable de implementación: GPT-6.1 Terra, razonamiento ligero. Este documento fija decisiones, orden de ejecución y criterios de aceptación para evitar volver a investigar o rediseñar durante la implementación.

## 1. Objetivo y alcance

Convertir el prototipo Electron existente en una estación de edición 360 oscura, coherente y bilingüe, conservando los métodos de eliminación y la exportación JPEG con calidad configurable. Implementar navegación, máscaras independientes, selección local de sujeto, sellos esféricos, información de imagen y bloqueo durante trabajos. Publicar el código propio bajo MIT en `Eseperio/esfera-editor`.

OCR, matrículas, anonimización de caras y vídeo son trabajo futuro: documentarlos en `ROADMAP.md`, sin presentar esas funciones como implementadas. No añadir servicio remoto de IA, cuentas, telemetría, React, servidor web permanente ni otro framework. Mantener Electron, Three, Sharp, Python/OpenCV y los helpers Swift disponibles.

## 2. Estado comprobado y problemas que deben resolverse

- `renderer.js` concentra estado, raycasting, pincel, navegación y llamadas IPC. La inercia suma movimientos opuestos durante 120 ms, por lo que un pequeño retroceso al levantar el dedo cancela el impulso. El wheel ignora todos los eventos sin `ctrlKey`.
- El visor emplea una esfera Three con cámara perspectiva y una textura JPEG de 4096 × 2048. Parte de la falta de detalle procede de esta reducción, no de una proyección incorrecta. La perspectiva es adecuada para editar; por encima de un campo amplio deforma mucho los bordes.
- Solo existen una máscara global, un conjunto de trazos y un resultado aplicado. El estado global mutable `current` del proceso principal no protege bien trabajos asíncronos si se abre otra imagen.
- El ancho del pincel se convierte linealmente a píxeles equirectangulares; no representa el mismo círculo visible cerca de polos o con distintos zooms.
- `main.js` contiene selección de archivo, procesado, preview y export. `guided.py` reconstruye una vista perspectiva desde el original y produce una capa PNG con alfa. LaMa trabaja a 800 × 800, dentro de una vista de 1600 px; no aumentar su tamaño ni descargar otro modelo generativo.
- La exportación actual conserva dimensiones y usa una sola codificación JPEG final, calidad 1–100 y 4:4:4. Hay que conservar esta propiedad. La comprobación previa de EXIF/XMP era sintética; no afirmar compatibilidad universal con los metadatos propietarios de Insta360.
- La interfaz tiene panel blanco, controles visibles sin imagen e indicador de trabajo pequeño que no bloquea la navegación.
- No existía un repositorio propio. Se ha creado Git dentro de esta carpeta y guardado el código inicial en `aaf52c3`. No tocar el Git del directorio padre ni proyectos hermanos.
- El grafo MCP solo lista otros proyectos. No hay herramienta `index_repository` disponible en esta sesión; se ha usado lectura directa de estos archivos. No afirmar que están indexados.

## 3. Arquitectura mínima y contratos

Dividir únicamente por responsabilidades reales. Nombres orientativos, no obligación de crear abstracciones vacías:

| Módulo | Responsabilidad |
| --- | --- |
| `renderer.js` | Arranque, coordinación de UI, enlaces de eventos y puente IPC |
| `lib/navigation.mjs` | Estimador de impulso, amortiguación y normalización de wheel; funciones puras comprobables |
| `lib/projection.mjs` | Convenciones esféricas, rayos de pantalla, proyección inversa y parámetros compartidos |
| `lib/document.mjs` | Documento, máscaras, sellos, selección activa, revisiones e historial |
| `lib/i18n.mjs` | Catálogos EN/ES, interpolación, idioma persistente y actualización del DOM |
| `lib/viewer.mjs` | Three/WebGL, texturas, pincel y contornos de sellos |
| `lib/processing.cjs` | Procesado secuencial desde el original, composición sin pérdidas intermedias |
| `lib/metadata.cjs` | Extracción y serialización de metadatos, sin enviar buffers gigantes al renderer |
| `native/SubjectMask.swift` | Selección de sujeto con Vision, sin pesos propios añadidos |

Documento: `imageId`, dimensiones, información, `revision`, `appliedRevision`, `activeMaskId`, `masks[]`, `stamps[]`. Cada máscara: identificador estable, nombre, activada, comandos de selección, método y ajustes propios, vista de procesado. Cada sello: identificador estable, recurso importado, posición angular, tamaño angular, rotación, máscara circular, escala interna y desplazamiento del contenido, activado.

Crear una máscara por defecto al abrir. Pintar y seleccionar sujeto siempre modifica la activa; aplicar no crea otra máscara. Crear, seleccionar, renombrar, activar/desactivar y eliminar máscaras; mantener una vacía si se elimina la última. La visibilidad de selección y la activación del efecto son conceptos distintos: el control de activación de la fila excluye ese efecto de preview/export; el overlay de selección solo se presenta durante edición. Mostrar nombres de controles y tooltips que no confundan ambos conceptos.

Historial de operaciones de documento: deshacer trazos, borrado, selección automática, alta/baja de máscaras y modificaciones de sellos. Agrupar un arrastre de slider como una operación. No copiar un canvas 4096 × 2048 para cada evento de puntero. Utilizar comandos inmutables/referencias a recursos y limitar el historial a 50 operaciones. Liberar recursos sin referencias al cerrar.

IPC propuesto: `capabilities`, `open`, `close`, `applyDocument`, `export`, `importStamp`, `selectSubject`, `setLanguage`. No exponer `fs`, `exec` ni rutas de ejecución arbitrarias al renderer. Validar tipos, números finitos, tamaños, cantidad de recursos y `imageId`. Los archivos importados se eligen en diálogos nativos y el proceso principal conserva sus rutas mediante tokens internos.

Una operación asíncrona captura un documento y archivo inmutables al comenzar. Un resultado solo se muestra si coincide su `imageId` y revisión. Un cerrojo en main impide abrir/cerrar/aplicar/exportar simultáneamente; el bloqueo visual no es la única protección. Errores con códigos traducibles y detalle técnico opcional; evitar que todos los errores nativos aparezcan solo en español.

## 4. Diseño visual y estados

Referencia visual generada: `docs/design/workstation-concept.png`. Es una referencia de interfaz, no una fotografía de ejemplo que deba cargarse automáticamente. Usar su jerarquía y componentes, con los tamaños siguientes adaptados al escritorio real. No hace falta otra generación de imágenes.

- Fondo `#18191b`, panel `#222326`, controles `#2b2d30`, divisores `#383a3e`, texto `#e5e6e8`, secundario `#999da4`, acento `#6ea8fe`. Selección roja translúcida. Sin paneles blancos, degradados, emojis ni tarjetas decorativas.
- Barra superior de 48 px: Esfera / 360 Editor, nombre del archivo, Abrir, Cerrar, idioma, Exportar JPEG. Exportar y cerrar solo con documento. No mostrar información inventada.
- Con documento: rail de herramientas de 48–56 px, visor flexible, inspector derecho de 290–310 px, barra inferior de vista y barra de estado. Botones con SVG consistente, tooltip y nombre accesible. Tipografía de sistema, controles 12–13 px, radios 4 px, divisores finos y foco visible.
- Inspector con pestañas Edición, Sello e Información. Solo mostrar ajustes correspondientes al método y modo. Máscaras encima de selección; método y ajustes avanzados debajo. Aplicar vista previa anclado al pie.
- Vacío: ocultar rail, inspector completo y controles de zoom. Mantener marca, Abrir, idioma y un mensaje central con botón Abrir panorama. El visor no debe reservar un panel invisible. Al cerrar volver exactamente a este estado.
- Tamaño mínimo viable 960 × 640; comprobar 1400 × 900 y un portátil 1100 × 720. En ventanas menores colapsar/permitir abrir inspector sin tapar controles esenciales; no hace falta convertir este producto de escritorio en una app móvil.
- Estados explícitos: vacío, preparado, selección modificada, preview vigente, error, procesando. `Exportar` solo utiliza una revisión aplicada; cualquier cambio que afecte píxeles invalida la preview. Cambiar idioma, pestaña, zoom o navegación no la invalida.

## 5. Inercia robusta y zoom inmediato

Separar el desplazamiento de cámara mientras se arrastra del estimador de velocidad al soltar. Nunca ignorar un movimiento real del puntero para corregir la inercia.

1. Guardar muestras `{dx,dy,t}` en píxeles CSS con reloj inyectable; usar eventos coalescidos cuando existan. Mantener 100–140 ms de historia.
2. Identificar el tramo dominante reciente por desplazamiento acumulado y velocidad. Un retroceso final solo es rebote si dura aproximadamente 35–45 ms y recorre menos de 2.5 px o menos del 20–25% del tramo dominante (con un límite absoluto pequeño de 4 px). Excluirlo únicamente del cálculo de lanzamiento. Si el movimiento inverso supera ese umbral o persiste, es un cambio de dirección intencional y debe ganar.
3. Calcular velocidad por regresión/suma ponderada temporal del tramo elegido, no solo por la última muestra. No cancelar el lanzamiento por un evento de 0 px al levantar el dedo.
4. Mantener mínimo de lanzamiento de 0.012 grados/ms para un arrastre real de al menos 2 px soltado en menos de unos 110–140 ms; no aplicar mínimo a clics, pausas de 150 ms o más, cancelación, cambio de modo o pérdida de foco. Proporcionalidad a velocidad hasta un máximo razonable, amortiguación exponencial con tau 240–280 ms e independencia de fps.
5. Topes de latitud anulan solo la velocidad vertical bloqueada, no el movimiento horizontal. Nuevo pointerdown corta la inercia anterior. `prefers-reduced-motion` desactiva lanzamiento y transiciones largas.
6. Wheel en el visor: aceptar tanto `ctrlKey` (pellizco) como wheel normal / dos dedos. Normalizar `deltaMode` 0/1/2. `preventDefault` solo dentro del visor con imagen y sin operación bloqueante; el panel sigue desplazándose normalmente. No añadir una segunda inercia artificial a la inercia nativa del trackpad.
7. Zoom en espacio logarítmico/normalizado. Respuesta al gesto inmediata, filtro corto de 35–60 ms como máximo; botones y presets pueden interpolar 120–180 ms. Ganancia inicial de pellizco aproximadamente el doble de la existente, afinable por constantes, no un ajuste extra en UI. Evitar que un delta muy grande salte de primer plano a planeta de golpe.
8. Slider, +/−, rueda y pellizco actualizan el mismo objetivo de zoom. No modificar el zoom del HTML/Electron ni interceptar rueda sobre sliders o paneles.

Pruebas con reloj: drag corto + 1 px inverso conserva dirección y mínimo; inversión intencional de 10 px cambia dirección; clic y pausa no impulsan; el desplazamiento tras 1 s coincide a 30/60/120 fps dentro de tolerancia; rueda normal y pinch funcionan; eventos en inspector no se consumen.

## 6. Visor, proyecciones y nitidez

Establecer una sola convención: dirección mundo `(cos(lat)cos(lon), sin(lat), cos(lat)sin(lon))`; UV equirectangular `u=wrap(atan2(z,x)/(2π))`, `v=acos(y)/π`, origen de imagen arriba. Eje derecho `(-sin(lon),0,cos(lon))`, arriba `cross(right,forward)`. Contrastar con `guided.py`. Verificar el flip vertical de texturas Three, no corregirlo con signos distintos en módulos diferentes.

Implementar rayos analíticos en un shader de pantalla completa y su equivalente JS. Esto permite perspectiva y estereográfica sin distorsionar una esfera ni desacoplar el pincel del render. Si se mantiene la esfera para perspectiva, su raycaster debe producir exactamente la misma dirección que la función compartida; el modo planeta necesita el inverso analítico real.

Zoom normalizado 0–100, de lejos a cerca: preset Perspectiva alrededor de 65 (FOV vertical 70°), Amplia 30 (110°) y Miniplaneta 0. Entre 30 y 100 interpolar FOV de 110° a 30°. Por debajo de 30 transicionar suavemente a estereográfica centrada en nadir. Para radio de pantalla normalizado `r = hypot(ndcX*aspect,ndcY)`, perspectiva `theta=atan(r*tan(fov/2))`, estereográfica `theta=2*atan(r*tan(stereoFov/4))`. `stereoFov` progresa hasta unos 300°; mezclar los ángulos con `smoothstep` y orientar el centro progresivamente a latitud −90°. En r=0 devolver forward. Nunca pasar 180° a `PerspectiveCamera`.

La dirección final es `forward*cos(theta) + normalized(right*ndcX*aspect + up*ndcY)*sin(theta)`. Invertir la función angular para dirección→pantalla (búsqueda acotada si se mezcla); mismo inverso para contornos. Conservar yaw/orientación al entrar/salir de planeta. Los botones identifican el preset activo sin fingir que un valor intermedio es un preset exacto. Presets e interpolaciones no deben borrar máscaras.

Mejorar textura del visor: solicitar resolución hasta `min(anchoOriginal, MAX_TEXTURE_SIZE, 8192)` por defecto, con límite de memoria y fallback a 4096 ante fallo. Imagen sin agrandar; mantener proporción. PNG de visualización o JPEG de calidad alta si el coste de carga lo exige, documentando que es solo preview. Configurar color sRGB, filtros y anisotropía sin cambiar píxeles del original. Informar en Información de la resolución real de la textura y de la fuente. No prometer vista 1:1 de 72 MP si se usa una textura reducida.

Procesamiento guiado/LaMa siempre recibe una vista rectilínea, nunca un miniplaneta tratado como perspectiva. Para cada máscara ajustar una vista perspectiva al conjunto de direcciones seleccionadas: centro por media vectorial, base estable, FOV mínimo con margen, dentro de un máximo razonable (110–120°). Si abarca direcciones incompatibles o detrás de cámara, devolver un error claro que pida separar en máscaras. Alternativamente reutilizar su vista capturada si contiene todos los píxeles. Mantener el aspect real: no limitar la altura de la vista de procesado sin recalcular su proyección. No silenciar una máscara fuera del encuadre.

Pruebas geométricas: retícula con ejes/longitudes identificados, roundtrip pantalla→dirección→pantalla, costura 0/360, polos, dimensiones de viewport distintas, coincidencia render/selección/sello y export. Preset planeta debe verse como una pequeña esfera de terreno rodeada de cielo, no como un FOV extremo rectilíneo.

## 7. Pincel y máscaras

- Mostrar contorno de pincel sobre el visor en modo pintar; ocultarlo fuera, durante navegación y durante procesado. Al mover el slider, presentar el contorno en la última posición válida o en el centro si el puntero está sobre el panel. Mantenerlo unos 700–1000 ms para ver el tamaño sin empezar a pintar.
- Definir pincel por huella esférica y proyectar esa misma huella para el contorno. Convertir el diámetro CSS elegido a radio angular mediante los rayos de pantalla alrededor del centro. Así el contorno puede deformarse en vistas muy amplias, pero coincide con lo pintado. No usar el ancho total del panorama dividido por el ancho del visor como equivalencia de pincel.
- Dibujar dabs geodésicos separados como máximo 1/3 de radio, interpolando sobre la esfera para no dejar huecos. Rasterizar sobre máscara equirectangular con envoltura horizontal y límites verticales. Para cada fila de latitud, la desigualdad `dot(center,direction)>=cos(radius)` proporciona un intervalo de longitudes; si incluye un polo puede ocupar toda la fila. Esto evita polígonos que atraviesen toda la imagen por la costura.
- Soportar Añadir/Borrar (composición source-over/destination-out) sobre la máscara activa. La selección de sujeto se incorpora como comando de máscara raster reproyectada y se puede corregir con el pincel y deshacer.
- Renderizar overlay de activa y opcionalmente otras con menor opacidad; los efectos aplicados se componen por orden de máscaras. No mezclar método/ajustes de una máscara al seleccionar otra. No persistir fotos personales en el repo ni localStorage; idioma y preferencias inocuas sí.

## 8. Aplicación, exportación y bloqueo de trabajos

Refactorizar procesado para recibir archivo fuente y snapshot explícitos. Recorrer máscaras activadas no vacías en orden; cada una se aplica sobre el resultado anterior. Usar temporales PNG o buffers sin pérdida; componer sellos al final. Nunca partir del JPEG mostrado en el visor. Para exportar volver a procesar la revisión aplicada desde el original y preservar tamaño, calidad elegida, 4:4:4 y una sola codificación JPEG final. No sobrescribir el original.

Es válido mantener el límite de 1600 px de la vista de LaMa y 800 px del modelo; documentarlo. Fuera de las regiones modificadas no remuestrear la fotografía original. No convertir todo el panorama a la resolución del visor. Probar que la composición sin pérdidas no cambia píxeles fuera del soporte de las máscaras/sellos, antes del JPEG final. Comprobar EXIF/XMP/ICC y orientación normalizada con fixtures.

Overlay centrado de pantalla completa durante selección automática, aplicación y exportación: fondo oscuro semitransparente, spinner, texto traducido («Eliminando con IA local…», «Aplicando máscara 2 de 3…», «Exportando JPEG…»). No inventar porcentajes. Marcar el contenido principal `inert`, `aria-busy`, gestionar foco y bloquear puntero, wheel y atajos. Finalizar drag/inercia al entrar. Mantener overlay vivo mientras el trabajo está en proceso separado; evitar bucles CPU largos en renderer.

Un único `withBusy`/`try...finally` restablece el estado tanto en éxito como en cancelación de diálogo/error. Rehabilitar controles según el documento, no todos indiscriminadamente. Tras el trabajo la navegación debe responder, sin tener que cambiar de modo ni recargar. No hace falta un botón Cancelar que no pueda detener realmente CoreML.

## 9. Selección local compacta

Decisión para esta entrega: Apple Vision `VNGenerateForegroundInstanceMaskRequest`, disponible desde macOS 14, mediante un helper Swift propio. No añadir PyTorch, SAM, modelos de cientos de MB ni descargar automáticamente pesos alternativos. Vision es una API del sistema y no exige empaquetar nuevos pesos en este repo; no afirmar tamaño total cero del modelo del sistema. Es selección de sujeto, no la herramienta Clean Up de Fotos.

Flujo: detener movimiento → capturar una vista 2D sin overlays → ejecutar helper en background → obtener máscara en coordenadas de esa vista → reproyectarla a la máscara equirectangular activa → mostrar selección para revisión, sin borrar automáticamente. Para miniplaneta reconducir suavemente a la vista perspectiva equivalente antes de inferencia y comunicarlo; no analizar la equirectangular distorsionada. En perspectiva utilizar exactamente el encuadre visible y registrar dimensiones/orientación.

Botón Seleccionar sujeto usa las instancias de primer plano; herramienta de clic permite escoger la instancia bajo el punto si es razonable en el alcance. Como mínimo ofrecer selección de primer plano con descripción honesta si incluye varios sujetos; no etiquetar como persona a cualquier objeto segmentado. Consulta `allInstances`, `instanceMask` y `generateScaledMaskForImage(forInstances:from:)`. El mapa de índices es UInt8; el mapa escalado puede ser float. Respetar bytesPerRow y origen superior al leer; exportar PNG gris/alfa con CoreImage.

`capabilities` informa SO, helper existente, disponibilidad de Vision y LaMa. En equipo no compatible, deshabilitar selección con motivo claro; el resto de edición sigue funcionando. Añadir `npm run setup:native` reproducible para compilar ambos helpers; no subir binarios. Probar compilación y ejecución reales en este Mac 15.5; resultado sin sujeto debe ser un caso válido, no máscara negra aplicada como éxito. Fallo no destruye selección anterior.

Alternativa futura portátil y compacta: MediaPipe Selfie Segmentation (segmenta personas, no sujetos genéricos). No se instala en esta entrega. Si se evalúa posteriormente, medir pesos y runtime completos, licencia y precisión en cuerpos pequeños; evitar equiparar el tamaño de pesos con tamaño total distribuido.

## 10. Panel Información

Pestaña de solo lectura con grupos: Archivo (nombre, formato, bytes, dimensiones, MP), Cámara/captura (fabricante/modelo, óptica, fecha, exposición, ISO), Ubicación si existe, Color/orientación, Panorama/GPano y otros metadatos. Añadir búsqueda sencilla por clave/valor si hay muchas etiquetas.

Usar Sharp para estructura y presencia/tamaño de bloques, y una dependencia pequeña como `exifr` para valores EXIF/XMP/IPTC/ICC admitidos. Serializar fechas y arrays de forma legible; bytes binarios se describen por tamaño. Limitar tamaño de valores renderizados y usar `textContent`, no `innerHTML` con metadatos. Mostrar «sin metadatos» solo si no existen; para bloques propietarios no interpretados mostrar que existen y su tamaño. La app no garantiza descifrar todo MakerNote. Mostrar fuente/visor por separado y explicar qué conserva la exportación.

No añadir edición de EXIF ni envíos de ubicación a servicios externos. README debe advertir que exportación normal conserva metadatos de ubicación existentes; el futuro flujo de anonimización tendrá su política propia.

## 11. Sellos/parches esféricos

Pestaña Sello: importar PNG/JPEG/WebP, imagen previa, botones Arriba (cenit +90°), Abajo (nadir −90°, predeterminado) y Colocar en posición actual. Último botón fija el centro al rayo central del visor en ese instante; después no sigue la cámara. Permitir cambiar posición de un sello seleccionado y añadir/eliminar sellos si ya hay uno. Al crear sin imagen usar círculo sólido configurable como placeholder funcional.

Guardar posición en esfera, no coordenadas de pantalla. Tamaño exterior como diámetro angular (por ejemplo 2–120°, predeterminado 24°), escala visual de la imagen dentro de ese soporte independiente. Rotación 0–360°. Contorno rojo representando el soporte exterior en el visor, actualizado en vivo durante sliders y colocación; no se exporta. Zoom de cámara no cambia el tamaño físico del sello.

Máscara circular opcional. Encuadre interno: escala de imagen y desplazamientos X/Y, con botón Centrar; una imagen cuadrada puede cubrir una máscara circular sin estirarse. Diferenciar etiquetas «Tamaño en panorama» y «Encuadre de imagen». La escala exterior nunca sustituye el zoom interno del recorte. Conservar alfa de PNG.

Proyección de sello sobre plano tangente: base forward/right/up en su posición (estable en polos usando longitud de referencia), `d=dot(ray,forward)`. Para `d>0`, `x=dot(ray,right)/(d*tan(diametro/2))`, `y=dot(ray,up)/(d*tan(diametro/2))`. Rechazar fuera del soporte; círculo usa `x*x+y*y<=1`. Aplicar rotación, aspecto original, escala interna y offset para muestrear la imagen. Misma ecuación en preview y composición a tamaño original, con alfa. Render CPU export por franjas o regiones para evitar matrices descomunales de 72 MP. Manejar costura y polos matemáticamente, sin pegar rectángulos equirectangulares.

No guardar placeholder/arco rojo como parte del original. Solo se exporta el sello activado real (círculo si no hay imagen), nunca controles. Cambios de sello invalidan la revisión aplicada. Reabrir/retocar requiere Aplicar de nuevo. Probar cenit, nadir, centro actual, imagen transparente, círculo, encuadre X/Y y cruce de costura.

## 12. Idiomas y documentación pública

EN/ES completos: etiquetas, tooltips, accesibilidad, vacío, errores, confirmaciones, diálogos y progreso. Detectar idioma inicial del sistema/navegador, fallback inglés, persistir selección del usuario. Cambiar en caliente sin perder foto, selección, posición o trabajos. Nombres propios introducidos por usuario no se traducen. Las máscaras por defecto sí usan el idioma al crearse. Evitar concatenar fragmentos difíciles de traducir.

`README.md` en inglés, `README.es.md` en español, enlaces recíprocos; sin emojis. Explicar propósito open source, estado experimental, requisitos, instalación desde clon limpio (`npm ci`), arranque, setup OpenCV/Vision/LaMa opcional, herramientas, máscaras/sellos, controles de navegación, JPEG/metadata y límites reales. No prometer INSP/DNG ni compatibilidad de Windows/Linux para helpers macOS. No publicar una app firmada si solo existe ejecución desde código.

Crear `LICENSE` MIT (decisión confirmada por Eros), `THIRD_PARTY_NOTICES.md` con dependencias y fuentes/licencias de LaMa y código adaptado, `CONTRIBUTING.md` y `AGENTS.md` breve orientado a IAs: objetivo editor 360 local, mapa de módulos, sistema de coordenadas, no subir imágenes/pesos/claves, pruebas locales y cómo ejecutar checks. Añadir scripts reproducibles para setup nativo, Python y descarga opcional LaMa con origen y comprobaciones; no volver a descargar pesos que ya existen.

`.gitignore`: node_modules, .venv, caches, modelos/compilados, binarios nativos, imágenes personales, exportaciones, .env, artefactos temporales. No ignorar fixtures sintéticos de pruebas por accidente. Publicar solo código/documentación/fixtures generados propios; nunca contenidos del directorio padre. El coordinador crea/push al repositorio público tras revisar el staging. El conector GitHub permite consulta, pero no crear repositorios; usar `gh` para creación/push (sesión Eseperio comprobada fuera del sandbox). No añadir colaboradores ni mensajes/PRs no solicitados.

## 13. ROADMAP técnico, separado de lo implementado

Crear `ROADMAP.md` con prioridades, dependencias, candidatos, fuentes y criterios de aceptación:

1. **OCR local sobre vistas rectificadas.** Apple Vision `VNRecognizeTextRequest` en Mac; evaluar PaddleOCR PP-OCR mobile para portabilidad. Generar vistas cubemap o rejilla perspectiva solapada al vuelo, con overscan para no perder letras en bordes; escala adaptada al tamaño del texto. Guardar texto/confianza/idioma y polígonos en coordenadas esféricas, no solo píxeles del crop. Fusionar duplicados entre vistas mediante distancia angular/IoU y texto normalizado. No descargar un modelo documental grande por defecto.
2. **Panel de textos y matrículas.** Lista con búsqueda, confianza y selección; clic centra cámara sobre centro esférico y ajusta FOV acotado según extensión, dibujando polígono. OCR por sí solo no clasifica con fiabilidad una matrícula: combinar detector compacto específico + contexto de vehículo + reglas de texto como indicio, nunca como garantía. Propuesta/revisión antes de aplicar; registrar falsos negativos y permitir añadir manualmente. Para privacidad usar redacción, no relleno generativo que pueda inventar caracteres.
3. **Caras y redacción.** Vision `VNDetectFaceRectanglesRequest` o MediaPipe Face Detector como candidatos locales. Evaluar caras pequeñas/de perfil, costuras y polos. Expandir máscaras para cubrir rasgos; pixelado/blur destructivos en el raster exportado, sin capas reversibles, thumbnails originales ni previews incrustadas que revelen datos. No prometer anonimato matemático con blur/pixelado; ofrecer cobertura opaca como opción de máxima supresión y quitar metadatos sensibles en el modo privacidad. Revisión humana y comparación de muestras quedan como criterio, no etiqueta «seguro» sin evidencia.
4. **Motor de redacción independiente del medio.** Contrato `regionAt(timestamp)` con polígonos/cajas esféricas y parámetros de efecto; compositor puro sobre frames que sirve para imágenes y vídeo. Separar detección, seguimiento, revisión y render final. Versionar manifiesto de regiones y parámetros; no incrustar píxeles originales en el export anonimizado. Los proyectos editables locales se distinguen de exportaciones irreversibles.
5. **Vídeo 360 eficiente.** Dos pasadas: detección a menor resolución/cadencia adaptativa + seguimiento; revisión de trayectorias; decodificación y aplicación final en frames originales. ByteTrack (MIT) como asociador de detecciones, Kalman para trayectoria y Lucas–Kanade piramidal/OpenCV para propagación entre detecciones. ByteTrack no detecta matrículas/caras por sí mismo. Re-detectar al perder confianza, tras oclusión, entrada de objetos o corte de escena. Guardar IDs, timestamps reales, polígonos, confianza y keyframes en manifiesto JSON/SQLite. Track en caras cubemap con traspaso por coordenadas esféricas o en espacio tangente, sin saltos en la costura. Render por bloques/ROIs y streaming, no cargar vídeo entero; FFmpeg para decode/encode y audio, estudiar aceleración VideoToolbox, evitar pases de compresión innecesarios. Mantener FPS variable/timestamps, audio/sincronía, proyección y metadatos 360 revisados; limpiar miniaturas/metadata que expongan información. Revisar licencias de detector, pesos y build de FFmpeg antes de distribuir.

Fuentes primarias para el documento:

- https://developer.apple.com/videos/play/wwdc2023/10176/ (Vision, instancias y máscaras)
- https://developer.apple.com/documentation/vision/vngenerateforegroundinstancemaskrequest
- https://developer.apple.com/documentation/vision/vnrecognizetextrequest
- https://developer.apple.com/documentation/vision/vndetectfacerectanglesrequest
- https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter
- https://github.com/PaddlePaddle/PaddleOCR
- https://github.com/FoundationVision/ByteTrack
- https://docs.opencv.org/4.x/dc/d6b/group__video__track.html

Son candidatos de arquitectura, no benchmarks realizados en Esfera. No especificar tamaños o tiempos sin medir la variante concreta.

## 14. Secuencia de trabajo y puertas de aceptación

1. Extraer estado/navegación/proyección comprobables y crear pruebas focalizadas con `node:test`; mantener app arrancable. No gastar en nuevas librerías de test.
2. Introducir documento/máscaras y snapshot IPC. Adaptar procesado a múltiples máscaras conservando pipeline PNG/JPEG. Probar dos máscaras disjuntas con métodos distintos y undo.
3. Sustituir UI según referencia, idiomas y vacío; dejar todos los controles conectados. No dar por terminada una pestaña con botones de mentira.
4. Navegación/zoom/proyecciones y pincel exacto. Retícula sintética, polos, seam, vuelta del modo planeta.
5. Información y sellos completos (incluido export, no solo overlay visual).
6. Helper Vision y reproyección de máscara. Compilar y ejecutar sin descargar pesos nuevos. Estado no compatible manejado.
7. Bloqueo centralizado y revisión de errores/cancelaciones; comprobar arrastrar después de aplicar y exportar.
8. Documentación, setup, licencias y ROADMAP. `npm run check`, pruebas unitarias/integración y smoke nativo.
9. QA visual local con app Electron mediante herramientas nativas o navegador embebido; no lanzar Chrome externo con Playwright. Comparar screenshot con concepto con `view_image`: distribución, paleta, tipografía, controles, alineaciones y jerarquía. Documentar solo desviaciones funcionales deliberadas. Una fotografía sintética de QA no pretende reproducir la foto ilustrativa del concepto.
10. El coordinador revisa cambios, staging y tamaño del repo; commit, crear/push GitHub público y comprobar SHA remoto. Entregar enlace y límites comprobados. No finalizar diciendo «todo probado» si falta gesto físico del trackpad o una imagen real 72 MP.

## 15. Matriz mínima de validación

| Área | Evidencia exigida |
| --- | --- |
| Vacío | Sin rail/inspector/zoom al iniciar y al cerrar |
| Navegación | Rebote corto, inversión real, pausa, click, fps; rueda normal y pinch; rueda en inspector intacta |
| Proyección | Retícula, roundtrip, polos/seam; miniplaneta real y vuelta continua |
| Pincel | Contorno al mover slider; diámetro/huella coinciden a distintos FOV; añadir/borrar/undo |
| Máscaras | Dos máscaras independientes, métodos propios, activar/desactivar, borrar/undo; ambas en export |
| Sellos | Cenit/nadir/posición actual; círculo y cuadrado transparente; escala exterior e interior distintas; export coincide |
| IA local | Vision ejecuta o informa no compatible; LaMa sigue funcionando; errors liberan bloqueo |
| Busy | Overlay central, teclado/puntero bloqueados, ninguna operación simultánea; navegación recuperada |
| Metadatos | Archivo sin tags y fixture EXIF/XMP/ICC; bloques desconocidos reconocidos como presentes |
| Calidad | Dimensiones originales, JPEG calidades distintas, metadatos, una sola compresión, cambios localizados |
| Idiomas | EN/ES sin perder documento; claves paritarias; errores/diálogos traducidos |
| Publicación | Clon instalable, setup documentado, sin modelos/fotos/secretos, MIT y terceros, SHA remoto verificado |

## 16. Instrucciones de ejecución económica

Ejecutar con Terra y razonamiento ligero. Mantener un solo agente implementador; no redistribuir sin necesidad. Reutilizar este análisis y las fuentes; no reabrir investigación general de modelos o UI. Consultar al coordinador únicamente ante contradicción técnica concreta. Ejecutar pruebas al cerrar cada dependencia importante, sin repetir checks completos tras cambios solo de prosa. Informar avances por hitos, errores reproducibles y límites. No sustituir una función solicitada por una anotación en ROADMAP salvo las que el usuario pidió expresamente para futuro. El coordinador mantiene publicación y revisión final; el implementador es propietario del código de la app y su documentación, salvo este plan.
