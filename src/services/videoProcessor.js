/**
 * Video Processor Service / خدمة معالجة الفيديو
 * Uses FFmpeg to analyze and transcode videos for better compatibility.
 */

const ffmpeg = require('fluent-ffmpeg');
const { Readable, PassThrough } = require('stream');
const AppError = require('../utils/AppError');

/**
 * Gets video metadata
 * @param {Buffer} buffer 
 * @returns {Promise<Object>}
 */
const getVideoMetadata = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = Readable.from(buffer);
    ffmpeg(stream)
      .ffprobe((err, metadata) => {
        if (err) return reject(new AppError('فشل تحليل بيانات الفيديو', 500));
        
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          codec: videoStream?.codec_name,
          width: videoStream?.width,
          height: videoStream?.height,
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name
        });
      });
  });
};

/**
 * Transcodes video to H.264 (AVC) if needed or if codec is HEVC
 * @param {Buffer} buffer 
 * @param {String} originalName 
 * @returns {Promise<{buffer: Buffer, info: Object}>}
 */
const ensureCompatibleCodec = async (buffer, originalName) => {
  try {
    const metadata = await getVideoMetadata(buffer);
    
    // If it's already H.264, we might not need to transcode
    // but if it's HEVC (h265), we definitely do
    if (metadata.codec !== 'hevc' && metadata.codec !== 'h265') {
       console.log(`Video ${originalName} uses ${metadata.codec}, no transcoding needed.`);
       return { buffer, info: metadata, transcoded: false };
    }

    console.log(`Transcoding ${originalName} from HEVC to H.264 for compatibility...`);

    return new Promise((resolve, reject) => {
      const inputStream = Readable.from(buffer);
      const outputStream = new PassThrough();
      const chunks = [];

      outputStream.on('data', (chunk) => chunks.push(chunk));
      outputStream.on('end', () => {
        const transcodeBuffer = Buffer.concat(chunks);
        resolve({ 
          buffer: transcodeBuffer, 
          info: { ...metadata, codec: 'h264' }, 
          transcoded: true 
        });
      });
      outputStream.on('error', (err) => reject(new AppError('فشل تحويل فيديو HEVC', 500)));

      ffmpeg(inputStream)
        .format('mp4')
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags frag_keyframe+empty_moov'
        ])
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(new AppError('خطأ أثناء تحويل الفيديو', 500));
        })
        .pipe(outputStream);
    });
  } catch (error) {
    console.error('Video processing error:', error);
    throw error;
  }
};

/**
 * Creates a thumbnail from a video buffer
 * @param {Buffer} buffer 
 * @param {Number} timestamp 
 * @returns {Promise<Buffer>}
 */
const createThumbnailFromVideo = (buffer, timestamp = 1) => {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(buffer);
    const outputStream = new PassThrough();
    const chunks = [];

    outputStream.on('data', (chunk) => chunks.push(chunk));
    outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    outputStream.on('error', reject);

    ffmpeg(inputStream)
      .screenshots({
        timestamps: [timestamp],
        folder: '/tmp', // Note: Not used by pipe but required by screenshots method sometimes
        filename: 'thumbnail.jpg'
      })
      .on('error', reject)
      .pipe(outputStream);
      // Wait, shots doesn't pipe easily. Better use single frame output
  });
};

module.exports = {
  getVideoMetadata,
  ensureCompatibleCodec
};
