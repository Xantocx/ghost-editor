const generatedIds = new Set();

export function uuid(length: number) {
    let result = '';
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    const charactersLength = characters.length;
    do {
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    } while (generatedIds.has(result));
    generatedIds.add(result);
    return result;
}