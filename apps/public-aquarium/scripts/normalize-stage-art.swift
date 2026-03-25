#!/usr/bin/env swift

import AppKit
import Foundation

struct Options {
  let size: Int
  let padding: Int
  let alphaThreshold: CGFloat
  let files: [String]
}

enum NormalizeError: Error, CustomStringConvertible {
  case invalidArguments(String)
  case unreadableImage(String)
  case renderFailed(String)
  case writeFailed(String)

  var description: String {
    switch self {
    case let .invalidArguments(message):
      return message
    case let .unreadableImage(path):
      return "Could not read image: \(path)"
    case let .renderFailed(path):
      return "Could not render normalized image: \(path)"
    case let .writeFailed(path):
      return "Could not write normalized image: \(path)"
    }
  }
}

func usage() -> String {
  [
    "Usage: swift scripts/normalize-stage-art.swift [--size 24] [--padding 1] file1.png file2.png ...",
    "Resizes transparent PNG stage art to a pixel-ready square canvas using nearest-neighbor sampling.",
  ].joined(separator: "\n")
}

func parseOptions(arguments: [String]) throws -> Options {
  var size = 24
  var padding = 1
  var alphaThreshold = CGFloat(0.01)
  var files: [String] = []

  var index = 0
  while index < arguments.count {
    let argument = arguments[index]
    switch argument {
    case "--size":
      index += 1
      guard index < arguments.count, let value = Int(arguments[index]), value > 0 else {
        throw NormalizeError.invalidArguments("Invalid --size value.\n\(usage())")
      }
      size = value
    case "--padding":
      index += 1
      guard index < arguments.count, let value = Int(arguments[index]), value >= 0 else {
        throw NormalizeError.invalidArguments("Invalid --padding value.\n\(usage())")
      }
      padding = value
    case "--alpha-threshold":
      index += 1
      guard index < arguments.count, let value = Double(arguments[index]), value >= 0, value <= 1 else {
        throw NormalizeError.invalidArguments("Invalid --alpha-threshold value.\n\(usage())")
      }
      alphaThreshold = CGFloat(value)
    case "--help", "-h":
      throw NormalizeError.invalidArguments(usage())
    default:
      files.append(argument)
    }
    index += 1
  }

  guard !files.isEmpty else {
    throw NormalizeError.invalidArguments("Missing image paths.\n\(usage())")
  }

  return Options(size: size, padding: padding, alphaThreshold: alphaThreshold, files: files)
}

func nonTransparentBounds(in bitmap: NSBitmapImageRep, alphaThreshold: CGFloat) -> NSRect {
  var minX = bitmap.pixelsWide
  var minY = bitmap.pixelsHigh
  var maxX = -1
  var maxY = -1

  for y in 0..<bitmap.pixelsHigh {
    for x in 0..<bitmap.pixelsWide {
      guard let color = bitmap.colorAt(x: x, y: y) else {
        continue
      }
      if color.alphaComponent <= alphaThreshold {
        continue
      }
      minX = min(minX, x)
      minY = min(minY, y)
      maxX = max(maxX, x)
      maxY = max(maxY, y)
    }
  }

  if maxX < minX || maxY < minY {
    return NSRect(x: 0, y: 0, width: bitmap.pixelsWide, height: bitmap.pixelsHigh)
  }

  return NSRect(
    x: minX,
    y: minY,
    width: (maxX - minX) + 1,
    height: (maxY - minY) + 1
  )
}

func normalizeImage(at path: String, options: Options) throws {
  let url = URL(fileURLWithPath: path)
  let originalData = try Data(contentsOf: url)
  guard let source = NSBitmapImageRep(data: originalData) else {
    throw NormalizeError.unreadableImage(path)
  }

  let cropRect = nonTransparentBounds(in: source, alphaThreshold: options.alphaThreshold)
  let innerSize = max(options.size - (options.padding * 2), 1)
  let scale = min(CGFloat(innerSize) / cropRect.width, CGFloat(innerSize) / cropRect.height)
  let targetWidth = max(Int((cropRect.width * scale).rounded()), 1)
  let targetHeight = max(Int((cropRect.height * scale).rounded()), 1)
  let targetRect = NSRect(
    x: (options.size - targetWidth) / 2,
    y: (options.size - targetHeight) / 2,
    width: targetWidth,
    height: targetHeight
  )

  guard let destination = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: options.size,
    pixelsHigh: options.size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else {
    throw NormalizeError.renderFailed(path)
  }

  NSGraphicsContext.saveGraphicsState()
  guard let context = NSGraphicsContext(bitmapImageRep: destination) else {
    throw NormalizeError.renderFailed(path)
  }
  NSGraphicsContext.current = context
  context.imageInterpolation = .none
  context.shouldAntialias = false
  NSColor.clear.setFill()
  NSBezierPath(rect: NSRect(x: 0, y: 0, width: options.size, height: options.size)).fill()
  source.draw(
    in: targetRect,
    from: cropRect,
    operation: .copy,
    fraction: 1,
    respectFlipped: true,
    hints: [.interpolation: NSImageInterpolation.none]
  )
  NSGraphicsContext.restoreGraphicsState()

  guard let png = destination.representation(using: .png, properties: [:]) else {
    throw NormalizeError.writeFailed(path)
  }

  do {
    try png.write(to: url, options: .atomic)
  } catch {
    throw NormalizeError.writeFailed(path)
  }

  print("normalized \(path) crop=\(Int(cropRect.width))x\(Int(cropRect.height)) -> \(options.size)x\(options.size)")
}

do {
  let options = try parseOptions(arguments: Array(CommandLine.arguments.dropFirst()))
  for file in options.files {
    try normalizeImage(at: file, options: options)
  }
} catch let error as NormalizeError {
  FileHandle.standardError.write(Data((error.description + "\n").utf8))
  exit(1)
} catch {
  FileHandle.standardError.write(Data(("Unexpected error: \(error)\n").utf8))
  exit(1)
}
