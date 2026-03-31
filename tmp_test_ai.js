
const run = async () => {
  const transformers = await import('@xenova/transformers');
  const { pipeline, env } = transformers;
  env.allowLocalModels = false;
  const modelName = 'Xenova/vit-gpt2-image-captioning';
  console.log('Testing', modelName);
  try {
    const pipe = await pipeline('image-to-text', modelName);
    console.log(modelName, 'Loaded successfully');
  } catch (err) {
    console.error(modelName, 'Error:', err.message);
  }
}
run();
