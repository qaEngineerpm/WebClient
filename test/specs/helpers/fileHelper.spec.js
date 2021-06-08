import { toFile } from '../../../src/helpers/imageHelper';
import { toBase64, readFileAsString, readFileAsBuffer } from '../../../src/helpers/fileHelper';
import img from '../../media/img';

describe('toBase64', () => {
    const type = 'image/png';
    const filename = 'image';
    let file;

    beforeAll(async () => {
        file = await toFile(img, filename);
    });

    it('should be a string', async () => {
        const base64str = await toBase64(file);
        expect(typeof base64str).toBe('string');
        expect(base64str).toMatch(/^data:\w+/);
    });

    it('should be an empty base64 on undefined file', async () => {
        const base64str = await toBase64(await toFile(null, filename));
        expect(base64str).toBe('data:');
    });

    it('should be a 64 string encoded', async () => {
        const base64str = await toBase64(file);
        expect(typeof window.atob(base64str.replace('data:image/png;base64,', ''))).toBe('string');
    });

    it('should be equals to the original', async () => {
        const str1 = await toBase64(file);
        const f = await toFile(str1, filename);
        const str2 = await toBase64(f);
        expect(str1).toBe(str2);
    });

    it('should keep the type', async () => {
        const base64str = await toBase64(file);
        const f = await toFile(base64str);
        expect(f.type).toBe(type);
    });
});

describe('readFile', () => {
    const filename = 'image';
    let file;

    beforeAll(async () => {
        file = await toFile(img, filename);
    });

    it('should be a an array buffer', async () => {
        const output = await readFileAsBuffer(file);
        expect(output instanceof ArrayBuffer).toBeTruthy();
    });

    it('should be a string !base 64', async () => {
        const output = await readFileAsString(file);
        expect(typeof output).toBe('string');
        expect(output.startsWith('data:')).toBe(false);
    });

    it('should throw an error if the file is not defined', async () => {
        try {
            await readFileAsString(null);
        } catch (e) {
            expect(typeof e.stack).toBe('string');
        }
    });

});
