import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';

console.log('FFmpeg Installer Path:', ffmpegInstaller.path);
console.log('Path exists:', fs.existsSync(ffmpegInstaller.path));

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

ffmpeg.getAvailableFormats((err, formats) => {
    if (err) {
        console.error('FFmpeg not available:', err.message);
        process.exit(1);
    } else {
        console.log('FFmpeg is available and working!');
        process.exit(0);
    }
});
