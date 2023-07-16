import videojs from 'video.js';
import { version as VERSION } from '../package.json';

// Default options for the plugin.
const defaults = {};

// Cache for image elements
const cache = {};

/**
 * Function to invoke when the player is ready.
 *
 * This is a great place for your plugin to initialize itself. When this
 * function is called, the player will have its DOM and child components
 * in place.
 * @function onPlayerReady
 * @param    {videojs.Player} player A Video.js player object.
 * @param    {object} [options] A plain object containing options for the plugin.
 */
const onPlayerReady = (player, options) => {
  player.addClass('vjs-vtt-thumbnails');
  player.vttThumbnails = new vttThumbnailsPlugin(player, options);
};

/**
 * A video.js plugin.
 *
 * In the plugin function, the value of `this` is a video.js `Player`
 * instance. You cannot rely on the player being in a "ready" state here,
 * depending on how the plugin is invoked. This may or may not be important
 * to you; if not, remove the wait for "ready"!
 * @function vttThumbnails
 * @param    {object} [options]
 *           An object of options left to the plugin author to define.
 */
const vttThumbnails = function(options) {
  this.ready(() => {
    const merge = videojs.obj?.merge || videojs.mergeOptions
    onPlayerReady(this, merge(defaults, options));
  });
};

/**
 * VTT Thumbnails class.
 *
 * This class performs all functions related to displaying the vtt
 * thumbnails.
 */
class vttThumbnailsPlugin {

  /**
   * Plugin class constructor, called by videojs on
   * ready event.
   * @function  constructor
   * @param    {videojs.Player} player A Video.js player object.
   * @param    {object} [options] A plain object containing options for the plugin.
   */
  constructor(player, options) {
    this.player = player;
    this.options = options;
    this.initializeThumbnails();
    this.registeredEvents = {};
    return this;
  }

  src(source) {
    this.resetPlugin();
    this.options.src = source;
    this.initializeThumbnails();
  }

  detach() {
    this.resetPlugin();
  }

  resetPlugin() {
    if (this.thumbnailHolder) {
      this.thumbnailHolder.remove();
    }

    if (this.progressBar) {
      this.progressBar.removeEventListener('mouseenter', this.registeredEvents.progressBarMouseEnter);
      this.progressBar.removeEventListener('mouseleave', this.registeredEvents.progressBarMouseLeave);
      this.progressBar.removeEventListener('mousemove', this.registeredEvents.progressBarMouseMove);
    }

    delete this.registeredEvents.progressBarMouseEnter;
    delete this.registeredEvents.progressBarMouseLeave;
    delete this.registeredEvents.progressBarMouseMove;
    delete this.progressBar;
    delete this.vttData;
    delete this.thumbnailHolder;
    delete this.lastStyle;
  }

  /**
   * Bootstrap the plugin.
   */
  initializeThumbnails() {
    if (!this.options.src) {
      return;
    }

    const baseUrl = this.getBaseUrl();
    const url = this.getFullyQualifiedUrl(this.options.src, baseUrl);

    this.getVttFile(url)
      .then((data) => {
        this.vttData = this.processVtt(data);
        this.setupThumbnailElement();
      });
  }

  /**
   * Builds a base URL should we require one.
   * @returns {string} Base url
   */
  getBaseUrl() {
    return [
      window.location.protocol,
      '//',
      window.location.hostname,
      (window.location.port ? ':' + window.location.port : ''),
      window.location.pathname
    ].join('').split(/([^/]*)$/gi).shift();
  }

  /**
   * Grabs the contents of the VTT file.
   * @param {string} url The url of the file
   * @returns {Promise} The request to the url
   */
  getVttFile(url) {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();

      request.data = {
        resolve
      };

      request.addEventListener('load', this.vttFileLoaded);
      request.open('GET', url);
      request.send();
    });
  }

  /**
   * Callback for loaded VTT file.
   */
  vttFileLoaded() {
    this.data.resolve(this.responseText);
  }

  // eslint-disable-next-line no-unused-vars
  setupThumbnailElement(data) {
    let mouseDisplay;

    if (!this.options.showTimestamp) {
      mouseDisplay = this.player.$('.vjs-mouse-display');
    }

    const thumbHolder = document.createElement('div');

    thumbHolder.setAttribute('class', 'vjs-vtt-thumbnail-display');
    this.progressBar = this.player.$('.vjs-progress-control');
    this.progressBar.append(thumbHolder);
    this.thumbnailHolder = thumbHolder;

    if (mouseDisplay && !this.options.showTimestamp) {
      mouseDisplay.classList.add('vjs-hidden');
    }

    this.registeredEvents.progressBarMouseEnter = () => {
      return this.onBarMouseenter();
    };

    this.registeredEvents.progressBarMouseLeave = () => {
      return this.onBarMouseleave();
    };

    this.progressBar.addEventListener('mouseenter', this.registeredEvents.progressBarMouseEnter);
    this.progressBar.addEventListener('mouseleave', this.registeredEvents.progressBarMouseLeave);
  }

  onBarMouseenter() {
    this.mouseMoveCallback = (event) => {
      this.onBarMousemove(event);
    };

    this.registeredEvents.progressBarMouseMove = this.mouseMoveCallback;
    this.progressBar.addEventListener('mousemove', this.registeredEvents.progressBarMouseMove);
    this.showThumbnailHolder();
  }

  onBarMouseleave() {
    if (this.registeredEvents.progressBarMouseMove) {
      this.progressBar.removeEventListener('mousemove', this.registeredEvents.progressBarMouseMove);
    }

    this.hideThumbnailHolder();
  }

  getXCoord(bar, mouseX) {
    const rect = bar.getBoundingClientRect();
    const documentElement = document.documentElement;

    return mouseX - (rect.left + (window.pageXOffset || documentElement.scrollLeft || 0));
  }

  onBarMousemove(event) {
    this.updateThumbnailStyle(
      videojs.dom.getPointerPosition(this.progressBar, event).x,
      this.progressBar.offsetWidth
    );
  }

  getStyleForTime(time) {
    for (let index = 0; index < this.vttData.length; index++) {
      const item = this.vttData[index];

      if (time >= item.start && time < item.end) {
        // Cache miss
        if (item.css.url && !cache[item.css.url]) {
          const image = new Image();

          image.src = item.css.url;
          cache[item.css.url] = image;
        }

        return item.css;
      }
    }
  }

  showThumbnailHolder() {
    this.thumbnailHolder.style.opacity = '1';
  }

  hideThumbnailHolder() {
    this.thumbnailHolder.style.opacity = '0';
  }

  updateThumbnailStyle(percent, width) {
    const duration = this.player.duration();
    const time = percent * duration;
    const currentStyle = this.getStyleForTime(time);

    if (!currentStyle) {
      return this.hideThumbnailHolder();
    }

    const xPos = percent * width;
    const thumbnailWidth = Number.parseInt(currentStyle.width, 10);
    const halfthumbnailWidth = thumbnailWidth >> 1;
    const marginRight = width - (xPos + halfthumbnailWidth);
    const marginLeft = xPos - halfthumbnailWidth;
    const translateText = 'translateX('
    if (marginLeft > 0 && marginRight > 0) {
      this.thumbnailHolder.style.transform = translateText + (xPos - halfthumbnailWidth) + 'px)';
    } else if (marginLeft <= 0) {
      this.thumbnailHolder.style.transform = translateText + 0 + 'px)';
    } else if (marginRight <= 0) {
      this.thumbnailHolder.style.transform = translateText + (width - thumbnailWidth) + 'px)';
    }

    if (this.lastStyle && this.lastStyle === currentStyle) {
      return;
    }

    this.lastStyle = currentStyle;

    for (const style in currentStyle) {
      if (currentStyle.hasOwn(style)) {
        this.thumbnailHolder.style[style] = currentStyle[style];
      }
    }
  }

  processVtt(data) {
    const processedVtts = [];
    const vttDefinitioninitions = data.split(/[\n\r]{2}/i);

    for (const vttDefinition of vttDefinitioninitions) {
      if (/(\d{2}:)?(\d{2}:)?\d{2}(.\d{3})?( ?--!?> ?)(\d{2}:)?(\d{2}:)?\d{2}(.\d{3})?[\n\r].*/gi.test(vttDefinition)) {
        const vttDefinitionSplit = vttDefinition.split(/[\n\r]/i);
        const vttTiming = vttDefinitionSplit[0];
        const vttTimingSplit = vttTiming.split(/ ?--!?> ?/i);
        const vttTimeStart = vttTimingSplit[0];
        const vttTimeEnd = vttTimingSplit[1];
        const vttImageDefinition = vttDefinitionSplit[1];
        const vttCssDefinition = this.getVttCss(vttImageDefinition);

        processedVtts.push({
          start: this.getSecondsFromTimestamp(vttTimeStart),
          end: this.getSecondsFromTimestamp(vttTimeEnd),
          css: vttCssDefinition
        });
      }
    }

    return processedVtts;
  }

  getFullyQualifiedUrl(path, base) {
    if (path.includes('//') || path.startsWith('data:')) {
      // We have a fully qualified path.
      return path;
    }

    if (base.indexOf('//') === 0) {
      // We don't have a fully qualified path, but need to
      // be careful with trimming.
      return [
        base.replaceAll(/\/$/gi, ''),
        this.trimSlashes(path)
      ].join('/');
    }

    if (base.indexOf('//') > 0) {
      // We don't have a fully qualified path, and should
      // trim both sides of base and path.
      return [
        this.trimSlashes(base),
        this.trimSlashes(path)
      ].join('/');
    }

    // If all else fails.
    return path;
  }

  getPropsFromDef(definition) {
    const imageDefinitionSplit = definition.split(/#xywh=/i);
    const imageUrl = imageDefinitionSplit[0];
    const imageCoords = imageDefinitionSplit[1];
    const splitCoords = imageCoords.match(/\d+/gi);

    return {
      x: splitCoords[0],
      y: splitCoords[1],
      w: splitCoords[2],
      h: splitCoords[3],
      image: imageUrl
    };
  }

  getVttCss(vttImageDefinition) {
    const cssObject = {};

    // If there isn't a protocol, use the VTT source URL.
    let baseSplit;

    baseSplit = this.options.src.includes('//') ? this.options.src.split(/([^/]*)$/gi).shift() : this.getBaseUrl() + this.options.src.split(/([^/]*)$/gi).shift();

    vttImageDefinition = this.getFullyQualifiedUrl(vttImageDefinition, baseSplit);

    if (!/#xywh=/i.test(vttImageDefinition)) {
      cssObject.background = 'url("' + vttImageDefinition + '")';
      return cssObject;
    }

    const imageProperties = this.getPropsFromDef(vttImageDefinition);

    cssObject.background = `url("${imageProperties.image}") no-repeat -${imageProperties.x}px -${imageProperties.y}px`;
    cssObject.width = imageProperties.w + 'px';
    cssObject.height = imageProperties.h + 'px';
    cssObject.url = imageProperties.image;

    return cssObject;
  }

  /**
   * deconstructTimestamp deconstructs a VTT timestamp
   * @param  {string} timestamp VTT timestamp
   * @returns {object}           deconstructed timestamp
   */
  deconstructTimestamp(timestamp) {
    const splitStampMilliseconds = timestamp.split('.');
    const timeParts = splitStampMilliseconds[0];
    const timePartsSplit = timeParts.split(':');

    return {
      milliseconds: Number.parseInt(splitStampMilliseconds[1], 10) || 0,
      seconds: Number.parseInt(timePartsSplit.pop(), 10) || 0,
      minutes: Number.parseInt(timePartsSplit.pop(), 10) || 0,
      hours: Number.parseInt(timePartsSplit.pop(), 10) || 0
    };

  }

  /**
   * getSecondsFromTimestamp
   * @param  {string} timestamp VTT timestamp
   * @returns {number}           timestamp in seconds
   */
  getSecondsFromTimestamp(timestamp) {
    const timestampParts = this.deconstructTimestamp(timestamp);

    return Number.parseInt((timestampParts.hours * (60 * 60)) +
      (timestampParts.minutes * 60) +
      timestampParts.seconds +
      (timestampParts.milliseconds / 1000), 10);
  }

  /**
   * trims whitespace and forward slashes from strings
   * @param {string} string_   source string
   * @returns {string}          trimmed string
   */
  trimSlashes(string_) {
    return string_.replaceAll(/^\s*\/+\s*|\s*\/+\s*$/g, '');
  }

}

// Register the plugin with video.js.
videojs.registerPlugin('vttThumbnails', vttThumbnails);

// Include the version number.
vttThumbnails.VERSION = VERSION;

export default vttThumbnails;
