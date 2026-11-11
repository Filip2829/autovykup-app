let segmenter;
self.onmessage = async ({ data: { source } }) => {
  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.backends.onnx.wasm.numThreads = 1;
    segmenter ||= pipeline('image-segmentation', 'onnx-community/ormbg-ONNX', {
      revision: '034e2d884afbab897e10e78fc5bb566b29533fd6', device: 'wasm', dtype: 'q8',
      progress_callback: event => {
        if (event.status === 'progress') self.postMessage({ progress: Math.round(event.progress || 0) });
      },
    }).catch(error => { segmenter = null; throw error; });
    const ready = await segmenter;
    self.postMessage({ phase: 'inference' });
    const output = await ready(source);
    const mask = output?.[0]?.mask;
    if (!mask || mask.channels !== 1) throw new Error('Model nevrátil masku vozu.');
    self.postMessage({ width: mask.width, height: mask.height, values: mask.data }, [mask.data.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
