import { BackSide, DoubleSide, CubeUVReflectionMapping, ObjectSpaceNormalMap, TangentSpaceNormalMap, NoToneMapping, LinearEncoding, sRGBEncoding, NormalBlending } from '../../constants.js';
import { Layers } from '../../core/Layers.js';
import { WebGLProgram } from './WebGLProgram.js';
import { WebGLShaderCache } from './WebGLShaderCache.js';
import { ShaderLib } from '../shaders/ShaderLib.js';
import { UniformsUtils } from '../shaders/UniformsUtils.js';

function WebGLPrograms( renderer, cubemaps, cubeuvmaps, extensions, capabilities, bindingStates, clipping ) {

	const _programLayers = new Layers();
	const _customShaders = new WebGLShaderCache();
	const programs = [];

	const isWebGL2 = capabilities.isWebGL2;
	const logarithmicDepthBuffer = capabilities.logarithmicDepthBuffer;
	const vertexTextures = capabilities.vertexTextures;
	let precision = capabilities.precision;

	const shaderIDs = {
		MeshDepthMaterial: 'depth',
		MeshDistanceMaterial: 'distanceRGBA',
		MeshNormalMaterial: 'normal',
		MeshBasicMaterial: 'basic',
		MeshLambertMaterial: 'lambert',
		MeshPhongMaterial: 'phong',
		MeshToonMaterial: 'toon',
		MeshStandardMaterial: 'physical',
		MeshPhysicalMaterial: 'physical',
		MeshMatcapMaterial: 'matcap',
		LineBasicMaterial: 'basic',
		LineDashedMaterial: 'dashed',
		PointsMaterial: 'points',
		ShadowMaterial: 'shadow',
		SpriteMaterial: 'sprite'
	};

	let _parameters = undefined;

	function getParameters( material, lights, shadows, scene, object ) {

		const fog = scene.fog;
		const geometry = object.geometry;
		const environment = material.isMeshStandardMaterial ? scene.environment : null;

		const envMap = ( material.isMeshStandardMaterial ? cubeuvmaps : cubemaps ).get( material.envMap || environment );
		const envMapCubeUVHeight = ( !! envMap ) && ( envMap.mapping === CubeUVReflectionMapping ) ? envMap.image.height : null;

		const shaderID = shaderIDs[ material.type ];

		// heuristics to create shader parameters according to lights in the scene
		// (not to blow over maxLights budget)

		if ( material.precision !== null ) {

			precision = capabilities.getMaxPrecision( material.precision );

			if ( precision !== material.precision ) {

				console.warn( 'THREE.WebGLProgram.getParameters:', material.precision, 'not supported, using', precision, 'instead.' );

			}

		}

		//

		const morphAttribute = geometry.morphAttributes.position || geometry.morphAttributes.normal || geometry.morphAttributes.color;
		const morphTargetsCount = ( morphAttribute !== undefined ) ? morphAttribute.length : 0;

		let morphTextureStride = 0;

		if ( geometry.morphAttributes.position !== undefined ) morphTextureStride = 1;
		if ( geometry.morphAttributes.normal !== undefined ) morphTextureStride = 2;
		if ( geometry.morphAttributes.color !== undefined ) morphTextureStride = 3;

		//

		let vertexShader, fragmentShader;
		let customVertexShaderID, customFragmentShaderID;

		if ( shaderID ) {

			const shader = ShaderLib[ shaderID ];

			vertexShader = shader.vertexShader;
			fragmentShader = shader.fragmentShader;

		} else {

			vertexShader = material.vertexShader;
			fragmentShader = material.fragmentShader;

			_customShaders.update( material );

			customVertexShaderID = _customShaders.getVertexShaderID( material );
			customFragmentShaderID = _customShaders.getFragmentShaderID( material );

		}

		const currentRenderTarget = renderer.getRenderTarget();

		const numMultiviewViews = currentRenderTarget && currentRenderTarget.isWebGLMultiviewRenderTarget ? currentRenderTarget.numViews : 0;

		const useAlphaTest = material.alphaTest > 0;
		const useClearcoat = material.clearcoat > 0;
		const useIridescence = material.iridescence > 0;

		if ( ! _parameters ) {

			_parameters = {};

		}

		_parameters.isWebGL2 = isWebGL2;

		_parameters.shaderID = shaderID;
		_parameters.shaderName = material.type;

		_parameters.vertexShader = vertexShader;
		_parameters.fragmentShader = fragmentShader;
		_parameters.defines = material.defines;

		_parameters.customVertexShaderID = customVertexShaderID;
		_parameters.customFragmentShaderID = customFragmentShaderID;

		_parameters.isRawShaderMaterial = material.isRawShaderMaterial === true;
		_parameters.glslVersion = material.glslVersion;

		_parameters.precision = precision;

		_parameters.instancing = object.isInstancedMesh === true;
		_parameters.instancingColor = object.isInstancedMesh === true && object.instanceColor !== null;

		_parameters.supportsVertexTextures = vertexTextures;
		_parameters.numMultiviewViews = numMultiviewViews;

		_parameters.outputEncoding = ( currentRenderTarget === null ) ? renderer.outputEncoding : ( currentRenderTarget.isXRRenderTarget === true ? currentRenderTarget.texture.encoding : LinearEncoding );
		_parameters.map = !! material.map;
		_parameters.matcap = !! material.matcap;
		_parameters.envMap = !! envMap;
		_parameters.envMapMode = envMap && envMap.mapping;
		_parameters.envMapCubeUVHeight = envMapCubeUVHeight;
		_parameters.lightMap = !! material.lightMap;
		_parameters.aoMap = !! material.aoMap;
		_parameters.emissiveMap = !! material.emissiveMap;
		_parameters.bumpMap = !! material.bumpMap;
		_parameters.normalMap = !! material.normalMap;
		_parameters.objectSpaceNormalMap = material.normalMapType === ObjectSpaceNormalMap;
		_parameters.tangentSpaceNormalMap = material.normalMapType === TangentSpaceNormalMap;

		_parameters.decodeVideoTexture = !! material.map && ( material.map.isVideoTexture === true ) && ( material.map.encoding === sRGBEncoding );

		_parameters.clearcoat = useClearcoat;
		_parameters.clearcoatMap = useClearcoat && !! material.clearcoatMap;
		_parameters.clearcoatRoughnessMap = useClearcoat && !! material.clearcoatRoughnessMap;
		_parameters.clearcoatNormalMap = useClearcoat && !! material.clearcoatNormalMap;

		_parameters.iridescence = useIridescence;
		_parameters.iridescenceMap = useIridescence && !! material.iridescenceMap;
		_parameters.iridescenceThicknessMap = useIridescence && !! material.iridescenceThicknessMap;

		_parameters.displacementMap = !! material.displacementMap;
		_parameters.roughnessMap = !! material.roughnessMap;
		_parameters.metalnessMap = !! material.metalnessMap;
		_parameters.specularMap = !! material.specularMap;
		_parameters.specularIntensityMap = !! material.specularIntensityMap;
		_parameters.specularColorMap = !! material.specularColorMap;

		_parameters.opaque = material.transparent === false && material.blending === NormalBlending;

		_parameters.alphaMap = !! material.alphaMap;
		_parameters.alphaTest = useAlphaTest;

		_parameters.gradientMap = !! material.gradientMap;

		_parameters.sheen = material.sheen > 0;
		_parameters.sheenColorMap = !! material.sheenColorMap;
		_parameters.sheenRoughnessMap = !! material.sheenRoughnessMap;

		_parameters.transmission = material.transmission > 0;
		_parameters.transmissionMap = !! material.transmissionMap;
		_parameters.thicknessMap = !! material.thicknessMap;

		_parameters.combine = material.combine;

		_parameters.vertexTangents = ( !! material.normalMap && !! geometry.attributes.tangent );
		_parameters.vertexColors = material.vertexColors;
		_parameters.vertexAlphas = material.vertexColors === true && !! geometry.attributes.color && geometry.attributes.color.itemSize === 4;
		_parameters.vertexUvs = !! material.map || !! material.bumpMap || !! material.normalMap || !! material.specularMap || !! material.alphaMap || !! material.emissiveMap || !! material.roughnessMap || !! material.metalnessMap || !! material.clearcoatMap || !! material.clearcoatRoughnessMap || !! material.clearcoatNormalMap || !! material.iridescenceMap || !! material.iridescenceThicknessMap || !! material.displacementMap || !! material.transmissionMap || !! material.thicknessMap || !! material.specularIntensityMap || !! material.specularColorMap || !! material.sheenColorMap || !! material.sheenRoughnessMap;
		_parameters.uvsVertexOnly = ! ( !! material.map || !! material.bumpMap || !! material.normalMap || !! material.specularMap || !! material.alphaMap || !! material.emissiveMap || !! material.roughnessMap || !! material.metalnessMap || !! material.clearcoatNormalMap || !! material.iridescenceMap || !! material.iridescenceThicknessMap || material.transmission > 0 || !! material.transmissionMap || !! material.thicknessMap || !! material.specularIntensityMap || !! material.specularColorMap || material.sheen > 0 || !! material.sheenColorMap || !! material.sheenRoughnessMap ) && !! material.displacementMap;

		_parameters.fog = !! fog;
		_parameters.useFog = material.fog === true;
		_parameters.fogExp2 = ( fog && fog.isFogExp2 );

		_parameters.flatShading = !! material.flatShading;

		_parameters.sizeAttenuation = material.sizeAttenuation;
		_parameters.logarithmicDepthBuffer = logarithmicDepthBuffer;

		_parameters.skinning = object.isSkinnedMesh === true;

		_parameters.morphTargets = geometry.morphAttributes.position !== undefined;
		_parameters.morphNormals = geometry.morphAttributes.normal !== undefined;
		_parameters.morphColors = geometry.morphAttributes.color !== undefined;
		_parameters.morphTargetsCount = morphTargetsCount;
		_parameters.morphTextureStride = morphTextureStride;

		_parameters.numDirLights = lights.directional.length;
		_parameters.numPointLights = lights.point.length;
		_parameters.numSpotLights = lights.spot.length;
		_parameters.numSpotLightMaps = lights.spotLightMap.length;
		_parameters.numRectAreaLights = lights.rectArea.length;
		_parameters.numHemiLights = lights.hemi.length;

		_parameters.numDirLightShadows = lights.directionalShadowMap.length;
		_parameters.numPointLightShadows = lights.pointShadowMap.length;
		_parameters.numSpotLightShadows = lights.spotShadowMap.length;
		_parameters.numSpotLightShadowsWithMaps = lights.numSpotLightShadowsWithMaps;

		_parameters.numClippingPlanes = clipping.numPlanes;
		_parameters.numClipIntersection = clipping.numIntersection;

		_parameters.dithering = material.dithering;

		_parameters.shadowMapEnabled = renderer.shadowMap.enabled && shadows.length > 0;
		_parameters.shadowMapType = renderer.shadowMap.type;

		_parameters.toneMapping = material.toneMapped ? renderer.toneMapping : NoToneMapping;
		_parameters.physicallyCorrectLights = renderer.physicallyCorrectLights;

		_parameters.premultipliedAlpha = material.premultipliedAlpha;

		_parameters.doubleSided = material.side === DoubleSide;
		_parameters.flipSided = material.side === BackSide;

		_parameters.useDepthPacking = !! material.depthPacking;
		_parameters.depthPacking = material.depthPacking || 0;

		_parameters.index0AttributeName = material.index0AttributeName;

		_parameters.extensionDerivatives = material.extensions && material.extensions.derivatives;
		_parameters.extensionFragDepth = material.extensions && material.extensions.fragDepth;
		_parameters.extensionDrawBuffers = material.extensions && material.extensions.drawBuffers;
		_parameters.extensionShaderTextureLOD = material.extensions && material.extensions.shaderTextureLOD;

		_parameters.rendererExtensionFragDepth = isWebGL2 || extensions.has( 'EXT_frag_depth' );
		_parameters.rendererExtensionDrawBuffers = isWebGL2 || extensions.has( 'WEBGL_draw_buffers' );
		_parameters.rendererExtensionShaderTextureLod = isWebGL2 || extensions.has( 'EXT_shader_texture_lod' );

		_parameters.customProgramCacheKey = material.customProgramCacheKey();

		return _parameters;

	}

	const _array = [];

	function getProgramCacheKey( parameters ) {

		_array.length = 0;

		if ( parameters.shaderID ) {

			_array.push( parameters.shaderID );

		} else {

			_array.push( parameters.customVertexShaderID );
			_array.push( parameters.customFragmentShaderID );

		}

		if ( parameters.defines !== undefined ) {

			for ( const name in parameters.defines ) {

				_array.push( name );
				_array.push( parameters.defines[ name ] );

			}

		}

		if ( parameters.isRawShaderMaterial === false ) {

			getProgramCacheKeyParameters( _array, parameters );
			getProgramCacheKeyBooleans( _array, parameters );
			_array.push( renderer.outputEncoding );

		}

		_array.push( parameters.customProgramCacheKey );

		return _array.join();

	}

	function getProgramCacheKeyParameters( array, parameters ) {

		array.push( parameters.precision );
		array.push( parameters.outputEncoding );
		array.push( parameters.envMapMode );
		array.push( parameters.envMapCubeUVHeight );
		array.push( parameters.combine );
		array.push( parameters.vertexUvs );
		array.push( parameters.fogExp2 );
		array.push( parameters.sizeAttenuation );
		array.push( parameters.morphTargetsCount );
		array.push( parameters.morphAttributeCount );
		array.push( parameters.numDirLights );
		array.push( parameters.numPointLights );
		array.push( parameters.numSpotLights );
		array.push( parameters.numSpotLightMaps );
		array.push( parameters.numHemiLights );
		array.push( parameters.numRectAreaLights );
		array.push( parameters.numDirLightShadows );
		array.push( parameters.numPointLightShadows );
		array.push( parameters.numSpotLightShadows );
		array.push( parameters.numSpotLightShadowsWithMaps );
		array.push( parameters.shadowMapType );
		array.push( parameters.toneMapping );
		array.push( parameters.numClippingPlanes );
		array.push( parameters.numClipIntersection );
		array.push( parameters.depthPacking );

	}

	function getProgramCacheKeyBooleans( array, parameters ) {

		_programLayers.disableAll();

		if ( parameters.isWebGL2 )
			_programLayers.enable( 0 );
		if ( parameters.supportsVertexTextures )
			_programLayers.enable( 1 );
		if ( parameters.instancing )
			_programLayers.enable( 2 );
		if ( parameters.instancingColor )
			_programLayers.enable( 3 );
		if ( parameters.map )
			_programLayers.enable( 4 );
		if ( parameters.matcap )
			_programLayers.enable( 5 );
		if ( parameters.envMap )
			_programLayers.enable( 6 );
		if ( parameters.lightMap )
			_programLayers.enable( 7 );
		if ( parameters.aoMap )
			_programLayers.enable( 8 );
		if ( parameters.emissiveMap )
			_programLayers.enable( 9 );
		if ( parameters.bumpMap )
			_programLayers.enable( 10 );
		if ( parameters.normalMap )
			_programLayers.enable( 11 );
		if ( parameters.objectSpaceNormalMap )
			_programLayers.enable( 12 );
		if ( parameters.tangentSpaceNormalMap )
			_programLayers.enable( 13 );
		if ( parameters.clearcoat )
			_programLayers.enable( 14 );
		if ( parameters.clearcoatMap )
			_programLayers.enable( 15 );
		if ( parameters.clearcoatRoughnessMap )
			_programLayers.enable( 16 );
		if ( parameters.clearcoatNormalMap )
			_programLayers.enable( 17 );
		if ( parameters.iridescence )
			_programLayers.enable( 18 );
		if ( parameters.iridescenceMap )
			_programLayers.enable( 19 );
		if ( parameters.iridescenceThicknessMap )
			_programLayers.enable( 20 );
		if ( parameters.displacementMap )
			_programLayers.enable( 21 );
		if ( parameters.specularMap )
			_programLayers.enable( 22 );
		if ( parameters.roughnessMap )
			_programLayers.enable( 23 );
		if ( parameters.metalnessMap )
			_programLayers.enable( 24 );
		if ( parameters.gradientMap )
			_programLayers.enable( 25 );
		if ( parameters.alphaMap )
			_programLayers.enable( 26 );
		if ( parameters.alphaTest )
			_programLayers.enable( 27 );
		if ( parameters.vertexColors )
			_programLayers.enable( 28 );
		if ( parameters.vertexAlphas )
			_programLayers.enable( 29 );
		if ( parameters.vertexUvs )
			_programLayers.enable( 30 );
		if ( parameters.vertexTangents )
			_programLayers.enable( 31 );
		if ( parameters.uvsVertexOnly )
			_programLayers.enable( 32 );

		array.push( _programLayers.mask );
		_programLayers.disableAll();

		if ( parameters.fog )
			_programLayers.enable( 0 );
		if ( parameters.useFog )
			_programLayers.enable( 1 );
		if ( parameters.flatShading )
			_programLayers.enable( 2 );
		if ( parameters.logarithmicDepthBuffer )
			_programLayers.enable( 3 );
		if ( parameters.skinning )
			_programLayers.enable( 4 );
		if ( parameters.morphTargets )
			_programLayers.enable( 5 );
		if ( parameters.morphNormals )
			_programLayers.enable( 6 );
		if ( parameters.morphColors )
			_programLayers.enable( 7 );
		if ( parameters.premultipliedAlpha )
			_programLayers.enable( 8 );
		if ( parameters.shadowMapEnabled )
			_programLayers.enable( 9 );
		if ( parameters.physicallyCorrectLights )
			_programLayers.enable( 10 );
		if ( parameters.doubleSided )
			_programLayers.enable( 11 );
		if ( parameters.flipSided )
			_programLayers.enable( 12 );
		if ( parameters.useDepthPacking )
			_programLayers.enable( 13 );
		if ( parameters.dithering )
			_programLayers.enable( 14 );
		if ( parameters.specularIntensityMap )
			_programLayers.enable( 15 );
		if ( parameters.specularColorMap )
			_programLayers.enable( 16 );
		if ( parameters.transmission )
			_programLayers.enable( 17 );
		if ( parameters.transmissionMap )
			_programLayers.enable( 18 );
		if ( parameters.thicknessMap )
			_programLayers.enable( 19 );
		if ( parameters.sheen )
			_programLayers.enable( 20 );
		if ( parameters.sheenColorMap )
			_programLayers.enable( 21 );
		if ( parameters.sheenRoughnessMap )
			_programLayers.enable( 22 );
		if ( parameters.decodeVideoTexture )
			_programLayers.enable( 23 );
		if ( parameters.opaque )
			_programLayers.enable( 24 );
		if ( parameters.numMultiviewViews )
			_programLayers.enable( 25 );

		array.push( _programLayers.mask );

	}

	function getUniforms( material ) {

		const shaderID = shaderIDs[ material.type ];
		let uniforms;

		if ( shaderID ) {

			const shader = ShaderLib[ shaderID ];
			uniforms = UniformsUtils.clone( shader.uniforms );

		} else {

			uniforms = material.uniforms;

		}

		return uniforms;

	}

	function acquireProgram( parameters, cacheKey ) {

		let program;

		// Check if code has been already compiled
		for ( let p = 0, pl = programs.length; p < pl; p ++ ) {

			const preexistingProgram = programs[ p ];

			if ( preexistingProgram.cacheKey === cacheKey ) {

				program = preexistingProgram;
				++ program.usedTimes;

				break;

			}

		}

		if ( program === undefined ) {

			program = new WebGLProgram( renderer, cacheKey, parameters, bindingStates );
			programs.push( program );

		}

		return program;

	}

	function releaseProgram( program ) {

		if ( -- program.usedTimes === 0 ) {

			// Remove from unordered set
			const i = programs.indexOf( program );
			programs[ i ] = programs[ programs.length - 1 ];
			programs.pop();

			// Free WebGL resources
			program.destroy();

		}

	}

	function releaseShaderCache( material ) {

		_customShaders.remove( material );

	}

	function dispose() {

		_customShaders.dispose();

	}

	return {
		getParameters: getParameters,
		getProgramCacheKey: getProgramCacheKey,
		getUniforms: getUniforms,
		acquireProgram: acquireProgram,
		releaseProgram: releaseProgram,
		releaseShaderCache: releaseShaderCache,
		// Exposed for resource monitoring & error feedback via renderer.info:
		programs: programs,
		dispose: dispose
	};

}


export { WebGLPrograms };
