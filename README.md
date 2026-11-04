[🇬🇧 English](README.md) · [🇪🇸 Español](README.es.md)

# Erase people and objects from panorama images with local AI in your MacBook

**Esfera is a free, open-source app for removing people and unwanted objects from 360° photos.**

Erase yourself from a panorama, remove a passer-by or clean up a distracting object. Esfera uses local AI to reconstruct the background, with results that can be almost imperceptible depending on the scene and selection.

Your photos stay on your computer. There are no accounts, subscriptions or cloud AI fees. The compact LaMa model runs locally on a MacBook, without a high-end workstation or an external GPU.

## What you can do

- **Erase with local AI.** Paint over an object and let LaMa fill in the background.
- **Choose another removal algorithm.** Try perspective-guided filling, edge stretching, nearby-background copying or blur when they suit the scene better.
- **Edit directly in 360°.** Look around the panorama and select objects in a natural perspective view, rather than painting on a distorted flat image.
- **Select subjects automatically.** Use local foreground selection, then refine the selection by hand.
- **Cover a tripod or add a logo.** Place image or color stamps anywhere on the sphere.
- **Export a full-size JPEG.** Choose the quality and retain supported source metadata.

The interface is available in English and Spanish.

## Requirements and platform support

Esfera's core stack—Electron, Three.js, Node.js, Sharp and Python/OpenCV—is cross-platform and designed to support other operating systems. **So far, Esfera has only been tested on macOS.**

The current local AI and automatic subject-selection integrations use Apple's Core ML and Vision frameworks. These features need alternative backends for Windows and Linux; those platforms are not ready-to-use supported targets yet.

To run the current macOS version from source, install:

- Node.js 22.12 or later and npm.
- Python 3.
- Xcode command-line tools.

Automatic subject selection requires macOS 14 or later. Development and testing have used macOS 15.5.

## Download the app

Get the **macOS Apple Silicon preview** from [GitHub Releases](https://github.com/Eseperio/esfera-editor/releases/tag/v0.2.0-preview.1). It includes its runtime, so Node.js, Python and Xcode are not needed to use the downloaded app.

1. Download and extract the ZIP, then move **Esfera.app** to Applications.
2. Open Esfera and choose **Local AI → Install model**. The model is downloaded once; your photos stay on your computer.
3. Open a panorama and start editing.

This preview requires macOS 14 or later and an Apple Silicon Mac. It is ad-hoc signed, **not Apple-notarized**, so macOS may require approval in Privacy & Security before the first launch. Intel, Windows and Linux builds are not provided yet.

## Run from source

```sh
git clone https://github.com/Eseperio/esfera-editor.git
cd esfera-editor
npm ci
npm run setup:python
npm run setup:native
npm run setup:lama
npm start
```

Alternatively, install the model from the **Local AI** button in the app. The LaMa setup downloads approximately **206 MiB** and compiles the model locally, which needs additional disk space. It verifies the downloaded files and reuses an already compiled model.

You can skip `npm run setup:lama` and use the other removal algorithms without AI. Model sources and licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Remove your first object

1. Open a panorama and look towards the person or object you want to remove.
2. Paint over it, or start with automatic subject selection and refine the result.
3. Choose **local AI removal** or another filling method.
4. Click **Apply** and inspect the result. Adjust the selection if needed.
5. **Export** your JPEG and choose its quality.

Apply again after making changes: export saves the last applied result.

## Supported images and export

|          | Support                                                              |
| -------- | -------------------------------------------------------------------- |
| Input    | 2:1 equirectangular JPEG, PNG or WebP panoramas, up to 75 megapixels |
| Output   | JPEG at the original dimensions, with quality selectable from 1–100  |
| Metadata | Supported source metadata is copied, including existing GPS data     |
| Color    | Exported as sRGB                                                     |

For Insta360 INSP or DNG files, first export a supported panorama from your camera software.

Processing uses lossless intermediates and a single final JPEG encoding. Local AI works on an 800 × 800 crop, so reconstructed areas can lose fine detail even though the exported image keeps its original dimensions. Results vary with the background and the size of the selection.

See the [validation notes](docs/VALIDATION.md) for further processing limits, color handling and metadata compatibility.

## Roadmap

Planned work includes local text, face and number-plate detection, dedicated blur and pixelation tools, and 360° video support. See [ROADMAP.md](ROADMAP.md).

Esfera is experimental. Feedback and examples that help improve removal quality are welcome.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [AGENTS.md](AGENTS.md) for development guidance.

Run the local checks after setting up the dependencies:

```sh
npm run check
```

## License

Esfera's own code is free software under the [MIT License](LICENSE). Third-party libraries and model components retain their respective licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
