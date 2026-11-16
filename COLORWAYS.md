# xTool colorways

The card's **Style** option draws the tile in the colors of an xTool machine: a **body** (the frame or case) and a **window** (the plexi or lid, behind the title). The editor has one style for each model, and one for each color a model is sold in. A new card gets its laser's model's style, in the first color listed below.

Models that look alike share a body and a window in the code (`BODIES`, `WINDOWS` and `MODEL_STYLES` in `xtool-card.js`). Every orange plexi is drawn with the same orange.

## Bodies

| Body | Base color | Light, dark | Finish |
| --- | --- | --- | --- |
| `champagne` | `#cdae94` | `#dcc1aa`, `#b8977c` | Metal |
| `grey` | `#808184` | `#97989b`, `#6b6c6f` | Metal |
| `silver` | `#b4b6b5` | `#c8cac9`, `#9d9f9e` | Metal |
| `blue_grey` | `#7d93ad` | `#93a8c1`, `#667a92` | Metal |
| `red` | `#a92a31` | `#c23c43`, `#8c1d22` | Metal |
| `white` | `#e6e6e6` | `#f4f4f3`, `#d3d3d3` | Plastic |
| `graphite` | `#2d3136` | `#3a3f45`, `#24272b` | Plastic |
| `charcoal` | `#2d2e30` | `#3a3b3e`, `#232426` | Plastic |

## Windows

| Window | Glass | Notes |
| --- | --- | --- |
| `orange` | `#f5a21a` to `#c2620f` | Orange plexi. Bright reflections. |
| `green` | `#6cc84a` to `#2f7a1d` | Green plexi. Bright reflections. |
| `smoke_amber` | `#1d2024` to `#0f1113`, amber glow | The P2 and P2S lid: dark, with the amber inside showing through. |
| `smoke` | `#2b2d31` to `#141518` | A smoked black lid or window. |
| `frame` | None | No window (the open D1 series): a recess in the body's own color. |

## Models

The sampled colors come from xTool's own product photos (a 7 by 7 pixel average). The card's colors are close to them, but tuned to read well on a dashboard.

| Style | Model | Body | Window | Sampled body | Sampled window | Reference photo |
| --- | --- | --- | --- | --- | --- | --- |
| `d1` | D1 | `blue_grey` | `frame` | `#7d93ad` | None | [D1](https://storage-us.atomm.com/resource/demoroom/device/D1.png) |
| `d1_pro_grey` | D1 Pro (Grey) | `blue_grey` | `frame` | `#7d93ad` | None | [D1 Pro](https://storage-us.atomm.com/resource/demoroom/device/D1%20Pro.png) |
| `d1_pro_red` | D1 Pro (Red) | `red` | `frame` | `#a92a31` | None | [D1 Pro, Red](https://img.matterhackers.com/g/Z3M6Ly9taC1wcm9kdWN0LWltYWdlcy9wcm9kLzBjNjJjMjY1LTJhMmQtNDYxOS04NmI4LWFjMDIwNmEwNDllOA=e365-w800-h800-c0xffffff-rj-pd) |
| `d1_pro_2_grey` | D1 Pro 2.0 (Grey) | `blue_grey` | `frame` | Same as the D1 Pro | None | As the D1 Pro |
| `d1_pro_2_red` | D1 Pro 2.0 (Red) | `red` | `frame` | Same as the D1 Pro | None | As the D1 Pro |
| `f1` | F1 | `silver` | `green` | `#b1b3b2` | `#62c465` | [F1](https://cdn.shopify.com/s/files/1/0809/1084/4198/files/mk-baidituyingyong_ca_pc_f1-whitebackground_5122-69954_87c9486e-1cab-4dd3-8263-d43b6e3985db.webp) |
| `f1_lite` | F1 Lite | `silver` | `green` | `#8ba282` | `#57c02b` | [F1 Lite](https://storage-us.atomm.com/resource/demoroom/device/F1.png) |
| `f1_ultra` | F1 Ultra | `grey` | `green` | `#838282` | `#499029` | [F1 Ultra](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/mk-baidituyingyong_au_pc_en-f1ultra-whitebackground_5144-593.webp) |
| `f1_ultra_v2` | F1 Ultra V2 | `grey` | `green` | Same as the F1 Ultra | Same as the F1 Ultra | As the F1 Ultra |
| `f2` | F2 | `champagne` | `orange` | `#a68f82` | `#dd761b` | [F2](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/mk-f2chanpinye_us_pc_f2_2488-2704.webp) |
| `f2_ultra` | F2 Ultra | `grey` | `smoke` | `#7d7e82` | `#393939` | [F2 Ultra](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/mk-f2ultra_us_pc_f2ultra_595-25304.webp) |
| `f2_ultra_single` | F2 Ultra (Single) | `grey` | `smoke` | Same as the F2 Ultra | Same as the F2 Ultra | As the F2 Ultra |
| `f2_ultra_uv` | F2 Ultra UV | `champagne` | `orange` | `#a68f82` | `#cc6321` | [F2 Ultra UV](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/mk-f2ultrauvchanpinye_us_pc_us-f2uvstandalone_3912-1431.webp) |
| `f2_ultra_uv_class_1` | F2 Ultra UV (Class 1) | `champagne` | `orange` | Same as the F2 Ultra UV | Same as the F2 Ultra UV | As the F2 Ultra UV |
| `laserbox_white` | Laserbox (White) | `white` | `smoke` | White | Smoked | [Laserbox Pro](https://xtool-web.oss-us-west-1.aliyuncs.com/assets/img/laserbox-pro/laserbox-pro.png) |
| `laserbox_black` | Laserbox (Black) | `charcoal` | `smoke` | Black | Smoked | [Laserbox Basic](https://xtool-web.oss-us-west-1.aliyuncs.com/assets/img/laserbox-pro/laserbox-basic.png) |
| `m1` | M1 | `white` | `orange` | `#f6f6f6` | Orange | [M1](https://storage-us.atomm.com/resource/demoroom/device/M1.png) |
| `m1_ultra` | M1 Ultra | `white` | `orange` | `#f0f0f0` | `#dc8122` | [M1 Ultra](https://cdn.shopify.com/s/files/1/0809/1084/4198/files/mk-baidituyingyong_ca_pc_m1ultra-whitebackground_5122-70511_08c68420-e2b9-412a-a972-9b9cb0774d97.webp) |
| `m2` | M2 | `white` | `orange` | `#eeeeee` | `#bd7f53` | [M2](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/m2-global_uk.jpg) |
| `metalfab` | MetalFab | `silver` | `smoke` | `#cccccc` | `#2d2d2d` (black panels) | [MetalFab](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/mk-baidituyingyong_eu_pc_metalfab_6646-15287.webp) |
| `o1_omni_printer` | O1 Omni Printer | `white` | `smoke` | `#eeeeee` | Smoked | [O1 Omni Printer](https://storage-us.atomm.com/resource/dic/owl/20261013/uNbvHXVvf/owl/2025/file-20261013102613/mk-a-o1omniprinter_us_pc_singleuvstandalone_11500-685.webp) |
| `p2_black` | P2 (Black) | `graphite` | `smoke_amber` | `#50555b` | `#885a31` | [P2, Black](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/mk-baidituyingyong_us_pc_p-black-whitebackground_7671-141.webp) |
| `p2_white` | P2 (White) | `white` | `smoke_amber` | `#e5e5e6` | Amber | [P2, White](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/mk-baidituyingyong_us_pc_p-white-whitebackground_7671-157.webp) |
| `p2s_black` | P2S (Black) | `graphite` | `smoke_amber` | `#50555b` | `#885a31` | [P2S, Black](https://cdn.shopify.com/s/files/1/0643/2715/5925/files/mk-baidituyingyong_eu_pc_p2s-black-standalone_5121-56432_e88d59bb-565e-4336-96b1-fedcc9df7139.webp) |
| `p2s_white` | P2S (White) | `white` | `smoke_amber` | `#e5e5e6` | Amber | [P2S, White](https://cdn.shopify.com/s/files/1/0643/2715/5925/files/mk-baidituyingyong_eu_pc_p2s-white-standalone_5121-56614_a0455e5c-1209-4afe-9b1b-54864bdf618c.webp) |
| `p3` | P3 | `white` | `smoke` | `#dbdbdb` | `#4d4d4d` | [P3](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/mk-p3_ca_pc_us-p3mainimage01_2330-8226.webp) |
| `retail_marker` | Retail Marker | `grey` | `green` | Same as the F1 Ultra | Same as the F1 Ultra | [Retail Marker](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/img_v3_02lf_a2dcb326-4f18-465a-b532-7daef8e0037g_fff76b8d-3720-406e-9e6e-ad9b44864756.jpg) |
| `s1_black` | S1 (Black) | `charcoal` | `green` | `#2d2e30` | `#649658` | [S1, Black](https://cdn.shopify.com/s/files/1/0764/1556/6128/files/mk-baidituyingyong_fr_pc_s1-10w-black-standalone_5108-25405.webp) |
| `s1_white` | S1 (White) | `white` | `orange` | `#e8e8e8` | `#c67410` | [S1, White](https://cdn.shopify.com/s/files/1/0764/1556/6128/files/mk-baidituyingyong_fr_pc_s1-10w-purewhite-standalone_5108-25397.webp) |
| `apparel_printer` | Apparel Printer | `white` | `smoke` | `#d7d7d7` | `#313131` | [Apparel Printer](https://cdn.shopify.com/s/files/1/0467/7985/9095/files/mk-a-dtf_us_pc_us-apparelprinter-whitebackground-en_15387-2119.webp) |

## Notes and sources

- **Variants with the same look.** The D1 Pro 2.0 has the D1 Pro's frame. The F1 Ultra V2 is a Class 1 version of the F1 Ultra. The F2 Ultra (Single) has the F2 Ultra's enclosure. The F2 Ultra UV (Class 1) has the F2 Ultra UV's enclosure. The Apparel Printer looks the same as the Apparel Printer Plus.
- **D1 series.** The D1 is grey only. The D1 Pro and D1 Pro 2.0 come in red or grey, the two colors of xTool's D1 and D1 Pro risers, which match the frame (xTool calls them Red and Grey on its UK store, Golden Red and Metal Grey on its German store). MatterHackers sells the red D1 Pro. The D1 series has no enclosure, so its style has no window.
- **P2 and P2S.** Both come in black (xTool calls it Grey on some stores) and white, as the variants of xTool's refurbished P2/P2S listings show.
- **S1.** Black with a green window, or white with an orange window (xTool's refurbished S1 listing).
- **Laserbox.** The Laserbox Pro is white with a smoked lid, and the Laserbox Basic is black.
- **Retail Marker.** The in-store version of the F1 Ultra. Its enclosure color can be customized for a store ([xTool support, article 2735](https://support.xtool.com/article/2735)); the card draws its standard look.
- **Model names** are the ones the xTool integration gives each device in Home Assistant (for example, "xTool F2 Ultra UV").
