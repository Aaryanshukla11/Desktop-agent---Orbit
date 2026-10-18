/**
 
 */
import sharp from 'sharp';

import { Conversation, type PredictionParsed } from '@UI-TARs/shared/types';

import { logger } from '@main/logger';
import { setOfMarksOverlays } from '@main/shared/setOfMarks';

// TODO: use jimp to mark click position
export async function markClickPosition(data: {
  base64: string;
  screenshotContext: NonNullable<Conversation['screenshotContext']>;
  parsed: PredictionParsed[];
}): Promise<string> {
  if (!data?.parsed?.length) {
    return data.base64;
  }
  try {
    const imageBuffer = Buffer.from(data.base64, 'base64');
    const { overlays = [] } = setOfMarksOverlays({
      predictions: data.parsed,
      screenshotContext: data.screenshotContext,
    });
    const imageOverlays: sharp.OverlayOptions[] = overlays
      .map((o) => {
        if (o.yPos && o.xPos) {
          return {
            input: Buffer.from(o.svg),
            top: o.yPos + o.offsetY,
            left: o.xPos + o.offsetX,
          };
        }
        return null;
      })
      .filter((overlay) => !!overlay);

    if (!imageOverlays?.length) {
      return '';
    }

    const result = await sharp(imageBuffer).composite(imageOverlays).toBuffer();

    return result.toString('base64');
  } catch (error) {
    logger.error('图片处理出错:', error);
    // return origin base64
    return '';
  }
}

/**
 * Overlays a subtle, high-contrast [0, 1000] coordinate grid onto a screenshot
 * so Vision-Language Models (VLMs) can ground target coordinates with exact alignment.
 */
export async function overlayCoordinateGrid(
  base64Image: string,
  width?: number,
  height?: number,
): Promise<string> {
  if (!base64Image) return base64Image;
  try {
    const rawBuffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const image = sharp(rawBuffer);
    const meta = await image.metadata();
    const w = width && width > 0 ? width : (meta.width || 1920);
    const h = height && height > 0 ? height : (meta.height || 1080);

    const scale = Math.max(1, w / 1280);
    const fontSize = Math.round(10 * scale);
    const badgeW = Math.round(34 * scale);
    const badgeH = Math.round(18 * scale);
    const badgeR = Math.round(3 * scale);

    const lines: string[] = [];
    const labels: string[] = [];
    const zones: string[] = [];

    // 1. Sector Dividing Lines (333 and 667) - Dark & BOLD
    const sectorLineW = Math.max(2, Math.round(2.5 * scale));
    const x333 = Math.round((333 / 1000) * w);
    const x667 = Math.round((667 / 1000) * w);
    const y333 = Math.round((333 / 1000) * h);
    const y667 = Math.round((667 / 1000) * h);

    // Dark shadow + bold cyan for maximum contrast on both white and dark apps
    lines.push(`<line x1="${x333}" y1="0" x2="${x333}" y2="${h}" stroke="#000000" stroke-width="${sectorLineW + 2}" opacity="0.8" />`);
    lines.push(`<line x1="${x333}" y1="0" x2="${x333}" y2="${h}" stroke="#00E5FF" stroke-width="${sectorLineW}" stroke-dasharray="8,4" opacity="0.9" />`);

    lines.push(`<line x1="${x667}" y1="0" x2="${x667}" y2="${h}" stroke="#000000" stroke-width="${sectorLineW + 2}" opacity="0.8" />`);
    lines.push(`<line x1="${x667}" y1="0" x2="${x667}" y2="${h}" stroke="#00E5FF" stroke-width="${sectorLineW}" stroke-dasharray="8,4" opacity="0.9" />`);

    lines.push(`<line x1="0" y1="${y333}" x2="${w}" y2="${y333}" stroke="#000000" stroke-width="${sectorLineW + 2}" opacity="0.8" />`);
    lines.push(`<line x1="0" y1="${y333}" x2="${w}" y2="${y333}" stroke="#00E5FF" stroke-width="${sectorLineW}" stroke-dasharray="8,4" opacity="0.9" />`);

    lines.push(`<line x1="0" y1="${y667}" x2="${w}" y2="${y667}" stroke="#000000" stroke-width="${sectorLineW + 2}" opacity="0.8" />`);
    lines.push(`<line x1="0" y1="${y667}" x2="${w}" y2="${y667}" stroke="#00E5FF" stroke-width="${sectorLineW}" stroke-dasharray="8,4" opacity="0.9" />`);

    // 2. 9 Macro Zone Badges (Deep dark black background with high-contrast borders)
    const zoneList = [
      { id: 'ZONE 1', xMin: 0, yMin: 0 },
      { id: 'ZONE 2', xMin: 333, yMin: 0 },
      { id: 'ZONE 3', xMin: 667, yMin: 0 },
      { id: 'ZONE 4', xMin: 0, yMin: 333 },
      { id: 'ZONE 5', xMin: 333, yMin: 333 },
      { id: 'ZONE 6', xMin: 667, yMin: 333 },
      { id: 'ZONE 7', xMin: 0, yMin: 667 },
      { id: 'ZONE 8', xMin: 333, yMin: 667 },
      { id: 'ZONE 9', xMin: 667, yMin: 667 },
    ];

    const zoneBadgeW = Math.round(74 * scale);
    const zoneBadgeH = Math.round(22 * scale);
    const zoneFontSize = Math.round(11 * scale);

    for (const z of zoneList) {
      const bx = Math.round((z.xMin / 1000) * w) + Math.round(14 * scale);
      const by = Math.round((z.yMin / 1000) * h) + Math.round(14 * scale);
      zones.push(
        `<rect x="${bx}" y="${by}" width="${zoneBadgeW}" height="${zoneBadgeH}" rx="4" fill="#000000" stroke="#00FFFF" stroke-width="2" opacity="0.95" />` +
        `<text x="${bx + Math.round(zoneBadgeW / 2)}" y="${by + Math.round(zoneBadgeH * 0.72)}" font-size="${zoneFontSize}" font-family="Consolas, monospace" font-weight="900" fill="#00FFFF" text-anchor="middle">${z.id}</text>`
      );
    }

    // 3. DOUBLED GRID: Primary lines every 50 units (dark under-shadow & crisp labels!)
    const strokeW = Math.max(1, Math.round(1.5 * scale));
    for (let gx = 50; gx < 1000; gx += 50) {
      if (gx === 333 || gx === 667) continue;
      const px = Math.round((gx / 1000) * w);
      const isMajor = gx % 100 === 0;

      lines.push(
        `<line x1="${px}" y1="0" x2="${px}" y2="${h}" stroke="#000000" stroke-width="${isMajor ? strokeW + 1 : strokeW}" opacity="${isMajor ? 0.75 : 0.55}" stroke-dasharray="${isMajor ? '6,4' : '3,3'}" />`
      );
      lines.push(
        `<line x1="${px}" y1="0" x2="${px}" y2="${h}" stroke="${isMajor ? '#00D9FF' : '#0088AA'}" stroke-width="${isMajor ? strokeW : 1}" opacity="${isMajor ? 0.80 : 0.60}" stroke-dasharray="${isMajor ? '6,4' : '3,3'}" />`
      );

      const curBadgeW = isMajor ? badgeW : Math.round(badgeW * 0.85);
      const curBadgeH = isMajor ? badgeH : Math.round(badgeH * 0.80);
      const curFontSize = isMajor ? fontSize : Math.round(fontSize * 0.85);

      labels.push(
        `<rect x="${px - Math.round(curBadgeW / 2)}" y="2" width="${curBadgeW}" height="${curBadgeH}" rx="${badgeR}" fill="#000000" stroke="${isMajor ? '#00FFFF' : '#00AACC'}" stroke-width="${isMajor ? 1.5 : 1}" opacity="0.95" />` +
        `<text x="${px}" y="${Math.round(curBadgeH * 0.72)}" font-size="${curFontSize}" font-family="Consolas, monospace" font-weight="bold" fill="${isMajor ? '#00FFFF' : '#A0EFFF'}" text-anchor="middle">${gx}</text>`
      );
      labels.push(
        `<rect x="${px - Math.round(curBadgeW / 2)}" y="${h - curBadgeH - 2}" width="${curBadgeW}" height="${curBadgeH}" rx="${badgeR}" fill="#000000" stroke="${isMajor ? '#00FFFF' : '#00AACC'}" stroke-width="${isMajor ? 1.5 : 1}" opacity="0.95" />` +
        `<text x="${px}" y="${h - Math.round(curBadgeH * 0.28)}" font-size="${curFontSize}" font-family="Consolas, monospace" font-weight="bold" fill="${isMajor ? '#00FFFF' : '#A0EFFF'}" text-anchor="middle">${gx}</text>`
      );
    }

    for (let gy = 50; gy < 1000; gy += 50) {
      if (gy === 333 || gy === 667) continue;
      const py = Math.round((gy / 1000) * h);
      const isMajor = gy % 100 === 0;

      lines.push(
        `<line x1="0" y1="${py}" x2="${w}" y2="${py}" stroke="#000000" stroke-width="${isMajor ? strokeW + 1 : strokeW}" opacity="${isMajor ? 0.75 : 0.55}" stroke-dasharray="${isMajor ? '6,4' : '3,3'}" />`
      );
      lines.push(
        `<line x1="0" y1="${py}" x2="${w}" y2="${py}" stroke="${isMajor ? '#00D9FF' : '#0088AA'}" stroke-width="${isMajor ? strokeW : 1}" opacity="${isMajor ? 0.80 : 0.60}" stroke-dasharray="${isMajor ? '6,4' : '3,3'}" />`
      );

      const curBadgeW = isMajor ? badgeW : Math.round(badgeW * 0.85);
      const curBadgeH = isMajor ? badgeH : Math.round(badgeH * 0.80);
      const curFontSize = isMajor ? fontSize : Math.round(fontSize * 0.85);

      labels.push(
        `<rect x="2" y="${py - Math.round(curBadgeH / 2)}" width="${curBadgeW}" height="${curBadgeH}" rx="${badgeR}" fill="#000000" stroke="${isMajor ? '#00FFFF' : '#00AACC'}" stroke-width="${isMajor ? 1.5 : 1}" opacity="0.95" />` +
        `<text x="${Math.round(curBadgeW / 2) + 2}" y="${py + Math.round(curFontSize * 0.35)}" font-size="${curFontSize}" font-family="Consolas, monospace" font-weight="bold" fill="${isMajor ? '#00FFFF' : '#A0EFFF'}" text-anchor="middle">${gy}</text>`
      );
      labels.push(
        `<rect x="${w - curBadgeW - 2}" y="${py - Math.round(curBadgeH / 2)}" width="${curBadgeW}" height="${curBadgeH}" rx="${badgeR}" fill="#000000" stroke="${isMajor ? '#00FFFF' : '#00AACC'}" stroke-width="${isMajor ? 1.5 : 1}" opacity="0.95" />` +
        `<text x="${w - Math.round(curBadgeW / 2) - 2}" y="${py + Math.round(curFontSize * 0.35)}" font-size="${curFontSize}" font-family="Consolas, monospace" font-weight="bold" fill="${isMajor ? '#00FFFF' : '#A0EFFF'}" text-anchor="middle">${gy}</text>`
      );
    }

    // 4. MICRO SUBDIVISION TICKS every 25 units (25, 75, 125, 175...) - Ultra dense, dark & crisp
    for (let gx = 25; gx < 1000; gx += 50) {
      const px = Math.round((gx / 1000) * w);
      lines.push(
        `<line x1="${px}" y1="0" x2="${px}" y2="${h}" stroke="#000000" stroke-width="1.5" opacity="0.45" stroke-dasharray="2,5" />`
      );
      lines.push(
        `<line x1="${px}" y1="0" x2="${px}" y2="${h}" stroke="#006688" stroke-width="1" opacity="0.55" stroke-dasharray="2,5" />`
      );
    }

    for (let gy = 25; gy < 1000; gy += 50) {
      const py = Math.round((gy / 1000) * h);
      lines.push(
        `<line x1="0" y1="${py}" x2="${w}" y2="${py}" stroke="#000000" stroke-width="1.5" opacity="0.45" stroke-dasharray="2,5" />`
      );
      lines.push(
        `<line x1="0" y1="${py}" x2="${w}" y2="${py}" stroke="#006688" stroke-width="1" opacity="0.55" stroke-dasharray="2,5" />`
      );
    }

    // 5. Taskbar Boundary Warning Line at Y = 940 (Bold dark red)
    const py940 = Math.round(0.94 * h);
    lines.push(`<line x1="0" y1="${py940}" x2="${w}" y2="${py940}" stroke="#000000" stroke-width="4" opacity="0.8" />`);
    lines.push(`<line x1="0" y1="${py940}" x2="${w}" y2="${py940}" stroke="#FF1744" stroke-width="2.5" stroke-dasharray="6,4" />`);
    labels.push(
      `<rect x="${w - Math.round(180 * scale)}" y="${py940 - Math.round(20 * scale)}" width="${Math.round(175 * scale)}" height="${Math.round(18 * scale)}" rx="3" fill="#000000" stroke="#FF1744" stroke-width="1.5" opacity="0.95" />` +
      `<text x="${w - Math.round(92 * scale)}" y="${py940 - Math.round(7 * scale)}" font-size="${Math.round(9.5 * scale)}" font-family="Consolas, monospace" font-weight="bold" fill="#FF1744" text-anchor="middle">▲ APP LIMIT / TASKBAR ▼</text>`
    );

    const svg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        ${lines.join('')}
        ${labels.join('')}
        ${zones.join('')}
      </svg>
    `;

    const compositeBuf = await image
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .toBuffer();

    return compositeBuf.toString('base64');
  } catch (err) {
    logger.warn('[overlayCoordinateGrid] Failed to overlay grid, returning original image:', err);
    return base64Image;
  }
}
