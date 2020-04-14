jQuery(function() {
	initAnchors();
	initBackgroundVideo();
});


// initialize smooth anchor links
function initAnchors() {
	new SmoothScroll({
		anchorLinks: 'a[href^="#"]:not([href="#"])',
		extraOffset: 0,
		wheelBehavior: 'none'
	});
}

// background video init
function initBackgroundVideo() {
	jQuery('.bg-video').backgroundVideo({
		activeClass: 'video-active'
	});
}


/*!
 * SmoothScroll module
 */
;(function($, exports) {
	// private variables
	var page,
		win = $(window),
		activeBlock, activeWheelHandler,
		wheelEvents = ('onwheel' in document || document.documentMode >= 9 ? 'wheel' : 'mousewheel DOMMouseScroll');

	// animation handlers
	function scrollTo(offset, options, callback) {
		// initialize variables
		var scrollBlock;
		if (document.body) {
			if (typeof options === 'number') {
				options = {
					duration: options
				};
			} else {
				options = options || {};
			}
			page = page || $('html, body');
			scrollBlock = options.container || page;
		} else {
			return;
		}

		// treat single number as scrollTop
		if (typeof offset === 'number') {
			offset = {
				top: offset
			};
		}

		// handle mousewheel/trackpad while animation is active
		if (activeBlock && activeWheelHandler) {
			activeBlock.off(wheelEvents, activeWheelHandler);
		}
		if (options.wheelBehavior && options.wheelBehavior !== 'none') {
			activeWheelHandler = function(e) {
				if (options.wheelBehavior === 'stop') {
					scrollBlock.off(wheelEvents, activeWheelHandler);
					scrollBlock.stop();
				} else if (options.wheelBehavior === 'ignore') {
					e.preventDefault();
				}
			};
			activeBlock = scrollBlock.on(wheelEvents, activeWheelHandler);
		}

		// start scrolling animation
		scrollBlock.stop().animate({
			scrollLeft: offset.left,
			scrollTop: offset.top
		}, options.duration, function() {
			if (activeWheelHandler) {
				scrollBlock.off(wheelEvents, activeWheelHandler);
			}
			if ($.isFunction(callback)) {
				callback();
			}
		});
	}

	// smooth scroll contstructor
	function SmoothScroll(options) {
		this.options = $.extend({
			anchorLinks: 'a[href^="#"]', // selector or jQuery object
			container: null, // specify container for scrolling (default - whole page)
			extraOffset: null, // function or fixed number
			activeClasses: null, // null, "link", "parent"
			easing: 'swing', // easing of scrolling
			animMode: 'duration', // or "speed" mode
			animDuration: 800, // total duration for scroll (any distance)
			animSpeed: 1500, // pixels per second
			anchorActiveClass: 'anchor-active',
			sectionActiveClass: 'section-active',
			wheelBehavior: 'stop', // "stop", "ignore" or "none"
			useNativeAnchorScrolling: false // do not handle click in devices with native smooth scrolling
		}, options);
		this.init();
	}
	SmoothScroll.prototype = {
		init: function() {
			this.initStructure();
			this.attachEvents();
			this.isInit = true;
		},
		initStructure: function() {
			var self = this;

			this.container = this.options.container ? $(this.options.container) : $('html,body');
			this.scrollContainer = this.options.container ? this.container : win;
			this.anchorLinks = jQuery(this.options.anchorLinks).filter(function() {
				return jQuery(self.getAnchorTarget(jQuery(this))).length;
			});
		},
		getId: function(str) {
			try {
				return '#' + str.replace(/^.*?(#|$)/, '');
			} catch (err) {
				return null;
			}
		},
		getAnchorTarget: function(link) {
			// get target block from link href
			var targetId = this.getId($(link).attr('href'));
			return $(targetId.length > 1 ? targetId : 'html');
		},
		getTargetOffset: function(block) {
			// get target offset
			var blockOffset = block.offset().top;
			if (this.options.container) {
				blockOffset -= this.container.offset().top - this.container.prop('scrollTop');
			}

			// handle extra offset
			if (typeof this.options.extraOffset === 'number') {
				blockOffset -= this.options.extraOffset;
			} else if (typeof this.options.extraOffset === 'function') {
				blockOffset -= this.options.extraOffset(block);
			}
			return {
				top: blockOffset
			};
		},
		attachEvents: function() {
			var self = this;

			// handle active classes
			if (this.options.activeClasses && this.anchorLinks.length) {
				// cache structure
				this.anchorData = [];

				for (var i = 0; i < this.anchorLinks.length; i++) {
					var link = jQuery(this.anchorLinks[i]),
						targetBlock = self.getAnchorTarget(link),
						anchorDataItem = null;

					$.each(self.anchorData, function(index, item) {
						if (item.block[0] === targetBlock[0]) {
							anchorDataItem = item;
						}
					});

					if (anchorDataItem) {
						anchorDataItem.link = anchorDataItem.link.add(link);
					} else {
						self.anchorData.push({
							link: link,
							block: targetBlock
						});
					}
				};

				// add additional event handlers
				this.resizeHandler = function() {
					if (!self.isInit) return;
					self.recalculateOffsets();
				};
				this.scrollHandler = function() {
					self.refreshActiveClass();
				};

				this.recalculateOffsets();
				this.scrollContainer.on('scroll', this.scrollHandler);
				win.on('resize.SmoothScroll load.SmoothScroll orientationchange.SmoothScroll refreshAnchor.SmoothScroll', this.resizeHandler);
			}

			// handle click event
			this.clickHandler = function(e) {
				self.onClick(e);
			};
			if (!this.options.useNativeAnchorScrolling) {
				this.anchorLinks.on('click', this.clickHandler);
			}
		},
		recalculateOffsets: function() {
			var self = this;
			$.each(this.anchorData, function(index, data) {
				data.offset = self.getTargetOffset(data.block);
				data.height = data.block.outerHeight();
			});
			this.refreshActiveClass();
		},
		toggleActiveClass: function(anchor, block, state) {
			anchor.toggleClass(this.options.anchorActiveClass, state);
			block.toggleClass(this.options.sectionActiveClass, state);
		},
		refreshActiveClass: function() {
			var self = this,
				foundFlag = false,
				containerHeight = this.container.prop('scrollHeight'),
				viewPortHeight = this.scrollContainer.height(),
				scrollTop = this.options.container ? this.container.prop('scrollTop') : win.scrollTop();

			// user function instead of default handler
			if (this.options.customScrollHandler) {
				this.options.customScrollHandler.call(this, scrollTop, this.anchorData);
				return;
			}

			// sort anchor data by offsets
			this.anchorData.sort(function(a, b) {
				return a.offset.top - b.offset.top;
			});

			// default active class handler
			$.each(this.anchorData, function(index) {
				var reverseIndex = self.anchorData.length - index - 1,
					data = self.anchorData[reverseIndex],
					anchorElement = (self.options.activeClasses === 'parent' ? data.link.parent() : data.link);

				if (scrollTop >= containerHeight - viewPortHeight) {
					// handle last section
					if (reverseIndex === self.anchorData.length - 1) {
						self.toggleActiveClass(anchorElement, data.block, true);
					} else {
						self.toggleActiveClass(anchorElement, data.block, false);
					}
				} else {
					// handle other sections
					if (!foundFlag && (scrollTop >= data.offset.top - 1 || reverseIndex === 0)) {
						foundFlag = true;
						self.toggleActiveClass(anchorElement, data.block, true);
					} else {
						self.toggleActiveClass(anchorElement, data.block, false);
					}
				}
			});
		},
		calculateScrollDuration: function(offset) {
			var distance;
			if (this.options.animMode === 'speed') {
				distance = Math.abs(this.scrollContainer.scrollTop() - offset.top);
				return (distance / this.options.animSpeed) * 1000;
			} else {
				return this.options.animDuration;
			}
		},
		onClick: function(e) {
			var targetBlock = this.getAnchorTarget(e.currentTarget),
				targetOffset = this.getTargetOffset(targetBlock);

			e.preventDefault();
			scrollTo(targetOffset, {
				container: this.container,
				wheelBehavior: this.options.wheelBehavior,
				duration: this.calculateScrollDuration(targetOffset)
			});
			this.makeCallback('onBeforeScroll', e.currentTarget);
		},
		makeCallback: function(name) {
			if (typeof this.options[name] === 'function') {
				var args = Array.prototype.slice.call(arguments);
				args.shift();
				this.options[name].apply(this, args);
			}
		},
		destroy: function() {
			var self = this;

			this.isInit = false;
			if (this.options.activeClasses) {
				win.off('resize.SmoothScroll load.SmoothScroll orientationchange.SmoothScroll refreshAnchor.SmoothScroll', this.resizeHandler);
				this.scrollContainer.off('scroll', this.scrollHandler);
				$.each(this.anchorData, function(index) {
					var reverseIndex = self.anchorData.length - index - 1,
						data = self.anchorData[reverseIndex],
						anchorElement = (self.options.activeClasses === 'parent' ? data.link.parent() : data.link);

					self.toggleActiveClass(anchorElement, data.block, false);
				});
			}
			this.anchorLinks.off('click', this.clickHandler);
		}
	};

	// public API
	$.extend(SmoothScroll, {
		scrollTo: function(blockOrOffset, durationOrOptions, callback) {
			scrollTo(blockOrOffset, durationOrOptions, callback);
		}
	});

	// export module
	exports.SmoothScroll = SmoothScroll;
}(jQuery, this));

/*
 * jQuery video background plugin
*/
;(function($, $win) {
	var BgVideoController = (function() {
		var videos = [];

		return {
			init: function() {
				$win.on('load.bgVideo resize.bgVideo orientationchange.bgVideo', this.resizeHandler.bind(this));
			},

			resizeHandler: function() {
				if (this.isInit) {
					$.each(videos, this.resizeVideo.bind(this));
				}
			},

			buildPoster: function($video, $holder) {
				$holder.css({
					'background-image': 'url(' + $video.attr('poster') + ')',
					'background-repeat':'no-repeat',
					'background-size':'cover'
				});
			},

			resizeVideo: function(i) {
				var item = videos[i];
				var styles = this.getDimensions({
					videoRatio: item.ratio,
					maskWidth: item.$holder.outerWidth(),
					maskHeight: item.$holder.outerHeight()
				});

				item.$video.css({
					width: styles.width,
					height: styles.height,
					marginTop: styles.top,
					marginLeft: styles.left
				});
			},

			getRatio: function($video) {
				return $video[0].videoWidth / $video[0].videoHeight ||
				$video.attr('width') / $video.attr('height') ||
				$video.width() / $video.height();
			},

			getDimensions: function(data) {
				var ratio = data.videoRatio,
					slideWidth = data.maskWidth,
					slideHeight = slideWidth / ratio;

				if (slideHeight < data.maskHeight) {
					slideHeight = data.maskHeight;
					slideWidth = slideHeight * ratio;
				}
				return {
					width: slideWidth,
					height: slideHeight,
					top: (data.maskHeight - slideHeight) / 2,
					left: (data.maskWidth - slideWidth) / 2
				};
			},

			add: function($video, options) {
				var $holder = options.videoHolder ? $video.closest(options.videoHolder) : $video.parent();
				var item = {
					$video: $video,
					$holder: $holder,
					options: options
				};

				if ($video.attr('poster')) {
					this.buildPoster($video, $holder);
				}

				if ($video[0].readyState) {
					this.onVideoReady(item);
					if ($video[0].paused) {
						$video[0].play();
					} else {
						$holder.addClass(options.activeClass);
					}
				} else {
					$video.one('loadedmetadata', function() {
						if ($video[0].paused) {
							$video[0].play();
						 } else {
							$holder.addClass(options.activeClass);
						 }
						 this.onVideoReady(item);
					}.bind(this));
				}

				$video.one('play', function() {
					$holder.addClass(options.activeClass);  
					this.makeCallback.apply($.extend(true, {}, this, item), ['onPlay']);
				}.bind(this));


				this.makeCallback.apply($.extend(true, {}, this, item), ['onInit']);
				return this;
			},

			onVideoReady: function(item) {
				if (!this.isInit) {
					this.isInit = true;
					this.init();
				}
				videos.push($.extend(item, {
					ratio: this.getRatio(item.$video)
				}));
				this.resizeVideo(videos.length - 1);
			},

			destroy: function($video) {
				if (!$video) {
					videos = videos.filter(this.destroySingle);
				} else {
					videos = videos.filter(function(item) {
						var removeFlag = item.$video.is($video);

						removeFlag && this.destroySingle(item);

						return !removeFlag;
					}.bind(this));
				}

				if (!videos.length) {
					this.isInit = false;
					$win.off('.bgVideo');
				}
			},

			destroySingle: function(item) {
				item.$video.removeAttr('style').removeData('BackgroundVideo')[0].pause();
				item.$holder.removeClass(item.options.activeClass);
			},

			makeCallback: function(name) {
				if (typeof this.options[name] === 'function') {
					var args = Array.prototype.slice.call(arguments);
					args.shift();
					this.options[name].apply(this, args);
				}
			}
		};
	}());

	$.fn.backgroundVideo = function(opt) {
		var args = Array.prototype.slice.call(arguments);
		var method = args[0];
		var options = $.extend({
			activeClass: 'video-active',
			videoHolder: null
		}, opt);
		
		return this.each(function() {
			var $video = jQuery(this);
			var instance = $video.data('BackgroundVideo');

			if (typeof opt === 'object' || typeof opt === 'undefined') {
				$video.data('BackgroundVideo', BgVideoController.add($video, options));
			} else if (typeof method === 'string' && instance) {
				if (typeof instance[method] === 'function') {
					args.shift();
					instance[method].apply(instance, args);
				}
			}
		});
	};

	window.BgVideoController = BgVideoController;

	return BgVideoController;
}(jQuery, jQuery(window)));