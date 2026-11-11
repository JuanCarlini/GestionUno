import { describe, it, expect } from "vitest"
import { parseId } from "./parse-id"
import { HttpError } from "./http-error"

describe("parseId", () => {
  it("convierte un id válido a number", () => {
    expect(parseId("42")).toBe(42)
  })

  it.each(["0", "-1", "1.5", "abc", "", undefined, "1e3", " 1"])(
    "rechaza %s con HttpError 400",
    (raw) => {
      expect(() => parseId(raw as string | undefined)).toThrow(HttpError)
      try {
        parseId(raw as string | undefined)
      } catch (e) {
        expect((e as HttpError).status).toBe(400)
      }
    }
  )
})
