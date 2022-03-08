const isValidHex = (hex: string) => /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex)

const getChunksFromString = (st: string, chunkSize: number) => st.match(new RegExp(`.{${chunkSize}}`, "g"))

const convertHexUnitTo256 = (hexStr: string) => parseInt(hexStr.repeat(2 / hexStr.length), 16)

export function hexToRGBA(hex: string, alpha: number | null = null): GPUColorDict {
    if (!isValidHex(hex)) { 
        throw new Error("Invalid HEX") 
    }
    const chunkSize = Math.floor((hex.length - 1) / 3);
    const hexArr = getChunksFromString(hex.slice(1), chunkSize);

    if (!hexArr) {
        throw new Error("Invalid HEX") 
    }

    const [r, g, b, a] = hexArr.map(convertHexUnitTo256);

    return {
        r, g, b, a: alpha ?? (a ?? 255)
    }
}

export function hexToRGBAUnit(hex: string, alpha: number): GPUColorDict {
    const color = hexToRGBA(hex, alpha)
    return {
        r: color.r / 255.0,
        g: color.g / 255.0,
        b: color.b / 255.0,
        a: alpha,
    }
}