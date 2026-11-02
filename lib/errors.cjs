const pairs = {
  "Another operation is already in progress.":
    "Ya hay otra operación en curso.",
  "Open an image first.": "Abre primero una imagen.",
  "Select at least one mask (maximum 32).": "Selecciona hasta 32 máscaras.",
  "Invalid mask.": "Máscara no válida.",
  "Add a selection or stamp first.": "Añade primero una selección o un sello.",
  "Apply the preview first.": "Aplica primero la vista previa.",
  "JPEG quality must be between 1 and 100.":
    "La calidad JPEG debe estar entre 1 y 100.",
  "Choose a JPEG file.": "Elige un archivo JPEG.",
  "Choose a file different from the original.":
    "Elige un archivo distinto al original.",
  "Invalid view.": "Vista no válida.",
  "Invalid stamps.": "Sellos no válidos.",
  "Invalid stamp setting.": "Ajuste de sello no válido.",
  "Unknown stamp image.": "Imagen de sello desconocida.",
  "Stamp image is too large.": "La imagen del sello es demasiado grande.",
  "The image must be a 2:1 equirectangular panorama up to 75 megapixels.":
    "La imagen debe ser un panorama equirectangular 2:1 de hasta 75 megapíxeles.",
  "Choose a nonzero offset to clone the background.":
    "Elige un desplazamiento distinto de cero para copiar el fondo.",
  "The local LaMa model is missing. See the README.":
    "Falta instalar o compilar el modelo LaMa local. Consulta el README.",
  "The current view is unavailable.":
    "No se ha podido obtener la vista actual.",
  "Unable to load the image or mask.":
    "No se pudo cargar la imagen o la máscara.",
  "The selection is empty.": "La selección está vacía.",
  "Fit the complete selection within the view and leave some margin before applying.":
    "Sitúa toda la selección dentro de la vista, dejando margen alrededor, antes de aplicar.",
  "The selection is too large. Zoom in and work in smaller areas.":
    "La selección es demasiado grande. Acércate y trabaja por zonas.",
  "Center the selection with more space around it.":
    "Centra la selección dejando más espacio alrededor.",
  "The model did not return a valid image.":
    "El modelo no ha devuelto una imagen válida.",
  "Unable to save the edited layer.": "No se pudo guardar la capa de edición.",
  "Cannot read panorama": "No se puede leer el panorama.",
  "Cannot write output": "No se puede guardar el resultado.",
};
function localizeError(message, lang) {
  const text = String(message || "");
  for (const [en, es] of Object.entries(pairs))
    if (text === en || text === es) return lang === "es" ? es : en;
  const prefix =
    lang === "es"
      ? "No se pudo completar la operación"
      : "The operation could not be completed";
  return `${prefix} (${text.slice(0, 500)})`;
}
module.exports = { localizeError };
