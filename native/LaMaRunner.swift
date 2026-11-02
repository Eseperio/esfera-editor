import Foundation
import CoreGraphics
import CoreImage
import CoreML
import ImageIO
import UniformTypeIdentifiers

// Pixel buffer conversion adapted from Erase, MIT, copyright 2026 dunebru.
func pixelBuffer(_ image: CGImage, gray: Bool) throws -> CVPixelBuffer {
    var result: CVPixelBuffer?
    let attrs: [String: Any] = [kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true]
    let status = CVPixelBufferCreate(nil, 800, 800, gray ? kCVPixelFormatType_OneComponent8 : kCVPixelFormatType_32BGRA, attrs as CFDictionary, &result)
    guard status == kCVReturnSuccess, let buffer = result else { throw NSError(domain: "Esfera", code: 1) }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    let space = gray ? CGColorSpaceCreateDeviceGray() : CGColorSpaceCreateDeviceRGB()
    let info: UInt32 = gray ? CGImageAlphaInfo.none.rawValue : (CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)
    guard let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: 800, height: 800, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: space, bitmapInfo: info) else { throw NSError(domain: "Esfera", code: 2) }
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: 0, y: 0, width: 800, height: 800))
    return buffer
}
func load(_ path: String) throws -> CGImage {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath:path) as CFURL,nil), let image = CGImageSourceCreateImageAtIndex(src,0,nil) else { throw NSError(domain:"Esfera: no se puede abrir el recorte",code:3) }
    return image
}
do {
    guard CommandLine.arguments.count == 5 else { throw NSError(domain:"Esfera: argumentos incompletos",code:4) }
    let config=MLModelConfiguration(); config.computeUnits = .cpuAndGPU
    let model=try MLModel(contentsOf: URL(fileURLWithPath:CommandLine.arguments[1]),configuration:config)
    let image=try pixelBuffer(load(CommandLine.arguments[2]),gray:false)
    let mask=try pixelBuffer(load(CommandLine.arguments[3]),gray:true)
    let input=try MLDictionaryFeatureProvider(dictionary:["image":MLFeatureValue(pixelBuffer:image),"mask":MLFeatureValue(pixelBuffer:mask)])
    let prediction=try model.prediction(from:input)
    guard let result=prediction.featureValue(for:"output")?.imageBufferValue else { throw NSError(domain:"Esfera: el modelo no devolvió imagen",code:5) }
    let ci=CIImage(cvPixelBuffer:result); let context=CIContext()
    guard let output=context.createCGImage(ci,from:ci.extent),let dest=CGImageDestinationCreateWithURL(URL(fileURLWithPath:CommandLine.arguments[4]) as CFURL,UTType.png.identifier as CFString,1,nil) else {throw NSError(domain:"Esfera: no se pudo crear el resultado",code:6)}
    CGImageDestinationAddImage(dest,output,nil)
    guard CGImageDestinationFinalize(dest) else { throw NSError(domain:"Esfera: no se pudo guardar el resultado",code:7) }
} catch { fputs("\(error.localizedDescription)\n",stderr); exit(1) }
