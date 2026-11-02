import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

if #available(macOS 14.0, *) {
    do {
        guard CommandLine.arguments.count == 3 else { throw NSError(domain: "Expected input and output paths", code: 1) }
        let input = URL(fileURLWithPath: CommandLine.arguments[1])
        let request = VNGenerateForegroundInstanceMaskRequest()
        let handler = VNImageRequestHandler(url: input)
        try handler.perform([request])
        guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
            print("no_subject"); exit(0)
        }
        let buffer = try observation.generateScaledMaskForImage(forInstances: observation.allInstances, from: handler)
        let image = CIImage(cvPixelBuffer: buffer)
        let context = CIContext()
        guard let cg = context.createCGImage(image, from: image.extent),
              let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[2]) as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            throw NSError(domain: "Cannot create subject mask", code: 2)
        }
        CGImageDestinationAddImage(destination, cg, nil)
        guard CGImageDestinationFinalize(destination) else { throw NSError(domain: "Cannot write subject mask", code: 3) }
        print("ok")
    } catch { fputs("\(error.localizedDescription)\n", stderr); exit(1) }
} else { fputs("macOS 14 or later required\n", stderr); exit(2) }
