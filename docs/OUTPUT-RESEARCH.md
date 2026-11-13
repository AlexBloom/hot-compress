# Output and platform research

Reviewed **November 13, 2026**. This is desk research of official format/platform documentation and Reddit experience reports. It is not a controlled experiment uploading the same masters to each service. App, web, publishing API, ad placement and subscription limits can differ; acceptance is not the same as delivered playback quality. The in-app guidance is a dated snapshot with source links, not a live guarantee.

## Decisions

Keep the default path unchanged: prepared WebP for opaque web images, PNG for alpha, and H.264 MP4. Customize selects the destination, then offers explicit formats and algorithm controls. Social upload presets spend more bytes retaining detail; self-hosted delivery presets prioritize download weight. Originals are always retained.

Quality/CRF values are **product choices**, not values supplied by each platform or perceptual equivalences between codecs. No single byte budget, “HD” toggle, export resolution or PNG trick guarantees that a service will bypass its own processing. Do not repeat lossy exports from already compressed variants when a cleaner master exists.

## Delivery versus ingestion

| Workflow | What Hot Compress produces | Decision and limit |
| --- | --- | --- |
| Self-hosted website | WebP/PNG, 2560 px bounded long edge; H.264 up to 1920 px/30 fps | Use only the image sizes the layout needs; responsive widths and sizes help. AVIF/JXL are optional. Alternative video codecs need client checks and typically a fallback. |
| App or image-CDN origin | JPEG/PNG at original image dimensions, image quality 92; video up to 3840 px at source fps | A source for downstream processing, not a native asset-catalog/App Store preset. Preserve your actual masters. Native device/OS support must be tested separately. |
| Instagram consumer upload | JPEG at ≤1080 px image width, quality 92; H.264 up to 1920 px long edge and 60 fps cap | 1080 is a conservative starting point, not a claim about every account's current limit. No forced cropping or upscaling. |
| Facebook | JPEG/PNG at ≤2048 px long edge; H.264 up to 1920 px | 2048 is a conservative product choice. A current universal Facebook limit was not verified behind the help-page login/rate limits. |
| TikTok | JPEG at ≤1080 px width/1920 px long edge; H.264 up to 1920 px/60 fps | A compatible, clean upload starting point. Composition is retained; use an editor for deliberate 9:16 cropping. |
| YouTube | H.264 up to 3840 px long edge, source fps, CRF 18 and stereo AAC 384 kbps | Retains real recorded motion and avoids automatic upscaling. Not a thumbnail, HDR or immersive-audio preset. |
| X | JPEG/PNG up to 2048 px; H.264 up to 1920 px/60 fps | Product dimensions, not a universal upload maximum. Account and upload-path limits still need checking. |
| General sharing | JPEG/PNG and H.264 MP4 | Compatibility-oriented. Use a file/document attachment or download link to transfer an unchanged original; there is no attachment-size budget in this version. |

### Platform facts and caveats

**Instagram:** Meta's current feed publishing API permits JPEG in sRGB, up to 8 MB and 1440 px wide, with an aspect ratio from 4:5 to 1.91:1. Reels accept H.264 or HEVC in MP4/MOV, 23–60 fps, up to 1920 horizontal pixels, VBR up to 25 Mbps, and recommend 9:16. These are API specifications; consumer-app behavior can differ. Our exports fit without cropping and report some incompatibilities. [Meta API reference](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media). The [consumer image-resolution help page](https://help.instagram.com/1631821640426723) could not be fetched reliably, so it does not establish an updated app-wide limit here.

**TikTok:** Its Content Posting API recommends MP4/H.264, accepts H.265/VP8/VP9, allows 23–60 fps and 360–4096 px on each side. Photo API upload supports JPEG/WebP, up to 20 MB, with the resolution limit described as “1080p.” We do not extrapolate that ambiguous photo wording into a strict every-side validator or into rules for all consumer app uploads. [TikTok media transfer guide](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide).

**YouTube:** Official guidance says to retain recorded fps and use progressive H.264 MP4. Reference SDR upload rates are 8/12 Mbps for 1080p and 35–45/53–68 Mbps for 2160p at standard/high fps. Our encoder uses constant-quality CRF, not those exact bitrates; content complexity determines the resulting rate. Audio is resampled to 48 kHz. [YouTube encoding guidance](https://support.google.com/youtube/answer/1722171?hl=en).

**X:** Current help differentiates upload limits by account tier: non-subscribers have a 140-second/512 MB path, while paid options have different allowances. Treat limits as account-specific and consult the current page. We deliberately avoid universal photo-size assertions from older cached advice. [X video help](https://help.x.com/en/using-x/x-videos), [X photo help](https://help.x.com/en/using-x/posting-gifs-and-pictures).

**Facebook:** The [photo quality help page](https://www.facebook.com/help/266520536764594) was login/rate limited. Common 2048 px guidance is not promoted here to a newly verified official requirement.

**App/CDN:** Next.js chooses negotiated image output using the request's Accept header, and its default output format is WebP; AVIF is configurable. This supports keeping a clean origin and letting the serving pipeline generate variants. It does not imply every app framework or CDN has the same behavior. [Next.js image documentation](https://nextjs.org/docs/app/api-reference/components/image).

## What Reddit adds—and does not establish

- [Instagram export discussion, February 2026](https://www.reddit.com/r/AskPhotography/comments/1r5oj1y/how_can_i_prevent_instagram_from_ruining_my_photo/) contains recommendations for 1080 px width and high-quality JPEG, plus conflicting PNG/no-compression claims. The disagreement is useful evidence against promising a bypass, not proof of any one tip.
- [Instagram reports, July 2026](https://www.reddit.com/r/photography/comments/1uph57j/how_do_you_prevent_quality_loss_when_uploading/) describe 1440-wide and other delivered dimensions. This conflicts with blanket 1080-max claims. Account, source and client differences are not controlled; users can override our width.
- [TikTok bitrate discussion, June 2025](https://www.reddit.com/r/Tiktokhelp/comments/1lhfs4a) favors 1080p in one report; [upload-path comparisons, August 2025](https://www.reddit.com/r/Tiktokhelp/comments/1mhe4yl) describe inconsistent frame rates by device/app. Newer [4K upload complaints](https://www.reddit.com/r/TikTok/comments/1xox3ey/4k60fps_uploading_issues/) still do not establish a universal workaround. Test your actual account/path using a clean master and review fully processed playback.
- [YouTube community VMAF tests, 2026](https://www.reddit.com/r/youtube/comments/1qax1qd/2026_update_best_upload_settings_for_youtube_vmaf/) are relevant as experiments, not policy. Codec allocation and the gain from upscaling are content/platform dependent. We preserve native motion and do not fabricate detail to chase transcoder behavior.

We do not automate Reddit's repeated advice to add aggressive sharpening, increase saturation or upscale 1080p to 4K. Those can hurt real images and cannot be justified by these uncontrolled reports. Optional output settings let users test alternatives without damaging the master.

## Algorithm guidance and current formats

| Algorithm / format | Useful choice | Implemented control |
| --- | --- | --- |
| JPEG, lossy DCT | Broad upload/photo compatibility | Quality; progressive encoding; 4:2:0 or 4:4:4 chroma. Never used to flatten alpha. |
| PNG, DEFLATE | Alpha, UI and graphics | Compression levels 0–9. No lossy palette quantization. |
| WebP | General browser delivery | Lossy quality or lossless prepared pixels. Our alpha policy still uses PNG. |
| AVIF, AV1 stills | Modern small photographic delivery | Quality; potentially slower encoding. No universal size/quality advantage is assumed. |
| TIFF | Rendered editing/interchange | ZIP or LZW lossless; JPEG lossy; uncompressed. Not archival RAW or normal web delivery. |
| HEIC, HEVC stills | Compatible device workflows | Quality; system libheif writer required. Not a default social upload. |
| JPEG XL | High-fidelity/lossless experiments and modern compatible clients | Dedicated cjxl/djxl tools, quality or lossless. Not JPEG bitstream reconstruction in this pipeline. |
| H.264 / MP4 | Broad video/upload compatibility | CRF, source/capped fps, fast start. |
| HEVC / MP4 | Compatible Apple/device or platform paths | libx265 CRF; verify actual client acceptance. |
| VP9 / WebM | Alternative browser video | libvpx CRF; use H.264 fallback where needed. |
| AV1 / MP4 | Modern capable players | SVT-AV1 CRF; slower/costlier encoding and variable social/API acceptance. |

Browser codec decisions are grounded in [MDN image guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types), [MDN video guidance](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs), [WebP's codec documentation](https://developers.google.com/speed/webp/docs/compression), and the [PNG specification](https://www.w3.org/TR/png-3/). Preserve-source-format always means a prepared, re-encoded copy, not unchanged bytes or an archival guarantee. Metadata removal, color conversion, RAW rendering and resizing precede encoding.

**A current JPEG XL change:** Chrome's October 6, 2026 announcement says decoding ships from Chrome 155. It specifically suggests comparing AVIF and JXL, with JXL useful for high fidelity, lossless and progressive display. Older browsers, embedded webviews and upload services still require compatibility checks. [Chrome announcement](https://developer.chrome.com/blog/jpeg-xl-in-chrome). Mozilla's August 2026 article discusses its intent to ship and the different strengths of JXL/AVIF; intent is not a universal installed-client guarantee. [Mozilla article](https://hacks.mozilla.org/2026/08/intent-to-ship-jpeg-xl/).

## RAW development

LibRaw's `dcraw_emu` develops sensor data at 16-bit into a temporary TIFF, using camera or automatic white balance and sRGB output. It is independent of ImageMagick's optional darktable delegate. Preserve-format RAW exports render to TIFF, since encoding back to proprietary sensor RAW would misrepresent the operation. [Official sample/tool flags](https://github.com/LibRaw/LibRaw/blob/master/samples/dcraw_emu.cpp), [supported cameras and build caveats](https://www.libraw.org/supported-cameras).

Not every extension means every camera mode is supported. Compressed RAW variants, pixel-shift/multi-shot modes, unusual DNG compression and new cameras depend on the LibRaw build. Camera color science and editor recipes are not reproduced by a generic rendering. We retain the source and surface decoder failures. Pixel-shift exposure merging and HDR/tone mapping are not part of this release.

## Verification limits

Automated checks validate files, dimensions, alpha, codec output, frame rate, RAW decoding and server behavior. They do not score perceptual fidelity on a representative corpus, run controlled platform-upload A/B tests, guarantee a file-size budget, or validate every app/account's publishing limits. Guidance is reviewed as a dataset in `src/guidance.ts`; update the review date and evidence together when policies change.
