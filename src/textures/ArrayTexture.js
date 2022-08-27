import { Texture } from './Texture.js';
import { ClampToEdgeWrapping, NearestFilter } from '../constants.js';

class ArrayTexture extends Texture {

	constructor( images = [], width = 1, height = 1, depth = 1 ) {

		super( null );

		this.isArrayTexture = true;

		this.image = { images, width, height, depth };

		this.magFilter = NearestFilter;
		this.minFilter = NearestFilter;

		this.wrapR = ClampToEdgeWrapping;

		this.generateMipmaps = false;
		this.flipY = false;
		this.unpackAlignment = 1;

	}

}

export { ArrayTexture };
