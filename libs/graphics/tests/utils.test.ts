import { hexToRGBAUnit } from '../src/utils';

it("should convert 0 hex string to 0 RGBA unit", () => {
    expect(hexToRGBAUnit("#000000", 0)).toStrictEqual<GPUColorDict>(
        {
            r: 0,
            b: 0,
            g: 0,
            a: 0
        }
    )
})