//
//  recorder.js
//  node-rtsp-recorder
//
//  Created by Sahil Chaddha on 24/08/2018.
//

const moment = require('moment')
const childProcess = require('child_process')
const path = require('path')
const FileHandler = require('./fileHandler')

const fh = new FileHandler()

const RTSPRecorder = class {
  constructor(config = {}) {
    this.config = config;
    this.stationName = config.stationName;
    this.subtitleText = config.subtitleText || '';
    this.url = config.url;
    this.timeLimit = config.timeLimit || 60;
    this.folder = config.folder || 'media/';
    this.categoryType = config.type || 'video';
    this.directoryPathFormat = config.directoryPathFormat || 'MMM-Do-YY';
    this.fileNameFormat = config.fileNameFormat || 'YYYY-M-D-h-mm-ss';
    fh.createDirIfNotExists(this.getDirectoryPath());
    fh.createDirIfNotExists(this.getTodayPath());
  }

  getDirectoryPath() {
    return path.join(this.folder, (this.stationName ? this.stationName : ''));
  }

  getTodayPath() {
    return path.join(this.getDirectoryPath(), moment().format(this.directoryPathFormat))
  }

  getMediaTypePath() {
    return path.join(this.getTodayPath(), this.categoryType)
  }

  getFilename(folderPath) {
    return path.join(folderPath, moment().format(this.fileNameFormat) + this.getExtenstion())
  }

  getExtenstion() {
    if (this.categoryType === 'audio') {
      return '.avi'
    }
    if (this.categoryType === 'image') {
      return '.jpg'
    }

    return '.mkv'
  }

  // getArguments() {
  //   var args = [];
  //   if (this.categoryType === 'audio') {
  //     args = ['-vn', '-acodec', 'copy'];
  //   } else if (this.categoryType === 'image') {
  //     args = ['-vframes', '1'];
  //   } else {
  //     args = ['-acodec', 'copy', '-vcodec', 'copy'];
  //     // 자막 텍스트 추가
  //     if (this.subtitleText) {
  //       args.push('-vf', `drawtext=text='${this.subtitleText}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2`);
  //     }
  //   }
  //   return args;
  // }
  getArguments() {
    var args = [];
    if (this.categoryType === 'audio') {
      args = ['-vn', '-acodec', 'copy'];
    } else if (this.categoryType === 'image') {
      args = ['-vframes', '1'];
    } else {
      // 재인코딩을 위해 코덱 옵션을 변경합니다.
      args = ['-acodec', 'aac', '-vcodec', 'libx264'];
      if (this.subtitleText) {
        args.push('-vf', `drawtext=fontfile=LSANS.TTF:text='${this.subtitleText}':fontcolor=red:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2`);
      }
    }
    return args;
  }

  getChildProcess(fileName) {
    console.log(this.url);
    // TCP 전송 프로토콜을 사용하도록 인자 추가
    var args = ['-rtsp_transport', 'tcp', '-i', this.url];
    const mediaArgs = this.getArguments();
    mediaArgs.forEach((item) => {
        args.push(item);
    });
    args.push(fileName);

    console.log(args);

    const ffmpegProcess = childProcess.spawn('ffmpeg', args, { detached: false, stdio: 'inherit' });

    return ffmpegProcess;
}
  stopRecording() {
    this.disableStreaming = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.writeStream) {
      this.killStream()
    }
  }

  startRecording() {
    if (!this.url) {
      console.log('URL Not Found.')
      return true
    }
    this.recordStream()
  }

  captureImage(cb) {
    this.writeStream = null
    const folderPath = this.getMediaTypePath()
    fh.createDirIfNotExists(folderPath)
    const fileName = this.getFilename(folderPath)
    this.writeStream = this.getChildProcess(fileName)
    this.writeStream.once('exit', () => {
      if (cb) {
        cb()
      }
    })
  }

  killStream() {
    this.writeStream.kill()
  }

  recordStream() {
    if (this.categoryType === 'image') {
      return
    }
    const self = this
    if (this.timer) {
      clearTimeout(this.timer)
    }

    if (this.writeStream && this.writeStream.binded) {
      return false
    }

    if (this.writeStream && this.writeStream.connected) {
      this.writeStream.binded = true
      this.writeStream.once('exit', () => {
        self.recordStream()
      })
      this.killStream()
      return false
    }

    this.writeStream = null
    const folderPath = this.getMediaTypePath()
    fh.createDirIfNotExists(folderPath)
    const fileName = this.getFilename(folderPath)
    this.writeStream = this.getChildProcess(fileName)

    this.writeStream.once('exit', () => {
      if (self.disableStreaming) {
        return true
      }
      self.recordStream()
    })
    this.timer = setTimeout(self.killStream.bind(this), this.timeLimit * 1000)

    console.log('Start record ' + fileName)
  }
}

module.exports = RTSPRecorder
