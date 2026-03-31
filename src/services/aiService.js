/**
 * AI Service / خدمة الذكاء الاصطناعي (Auto-Tagging)
 * 100% Free AI vision tagging using Hugging Face Transformers.js locally
 */

let pipeline, env;

const path = require('path');

// Require sharp here at the top-level to prevent DLL initialization conflicts 
// between ONNX Runtime (used by Transformers.js) and libvips (used by Sharp)
const sharp = require('sharp');
const MODEL_TAGS = 'Xenova/vit-base-patch16-224';
const MODEL_CAPTION = 'Xenova/vit-gpt2-image-captioning';

class AIService {
  static instances = { tags: null, caption: null };

  static async getInstances() {
    if (this.instances.tags === null || this.instances.caption === null) {
      console.log(`[AI Service] Loading dual vision models for Auto-Tagging and Captioning. This takes a moment on first run...`);
      
      const transformers = await import('@xenova/transformers');
      pipeline = transformers.pipeline;
      env = transformers.env;

      env.allowLocalModels = false; 
      env.useBrowserCache = false; 
      env.cacheDir = path.join(__dirname, '../../.cache/hf_models');

      // Load both pipelines
      const [tagger, captioner] = await Promise.all([
        pipeline('image-classification', MODEL_TAGS),
        pipeline('image-to-text', MODEL_CAPTION)
      ]);
      
      this.instances.tags = tagger;
      this.instances.caption = captioner;
      console.log('[AI Service] Both vision models loaded successfully!');
    }
    return this.instances;
  }

  /**
   * Generates intelligent tags and description for a given image buffer.
   * @param {Buffer} imageBuffer - The image buffer to classify
   * @returns {Promise<{tags: string[], description: string}>}
   */
  static async analyzeImage(imageBuffer) {
    try {
      const { tags: tagger, caption: captioner } = await this.getInstances();
      const sharp = require('sharp');

      // Normalize image for the Vision model (ViT expects 224x224 RGB)
      const { data, info } = await sharp(imageBuffer)
        .resize(224, 224, { fit: 'inside' })
        .removeAlpha() // ensure 3 channels (RGB)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const transformers = await import('@xenova/transformers');
      const rawImg = new transformers.RawImage(data, info.width, info.height, info.channels);

      console.log('[AI Service] Analyzing image for tags and description...');
      
      // Run both inferences in parallel
      const [tagResults, captionResults] = await Promise.all([
        tagger(rawImg, { topk: 5 }),
        captioner(rawImg)
      ]);

      const generatedTags = [];
      for (const res of tagResults) {
        if (res.score > 0.02) {
          const labels = res.label
            .split(',')
            .map(l => l.trim().toLowerCase())
            .filter(l => l.length > 2);
          generatedTags.push(...labels);
        }
      }
      const uniqueTags = [...new Set(generatedTags)];
      
      let description = '';
      if (captionResults && captionResults.length > 0 && captionResults[0].generated_text) {
        description = captionResults[0].generated_text.trim();
        // Capitalize first letter
        description = description.charAt(0).toUpperCase() + description.slice(1);
      }
      
      console.log('[AI Service] Generated:', { tags: uniqueTags, description });
      
      return { tags: uniqueTags, description };

    } catch (error) {
      console.error('[AI Service Error] Failed to analyze image:', error.message);
      return { tags: [], description: '' };
    }
  }
}

module.exports = AIService;
