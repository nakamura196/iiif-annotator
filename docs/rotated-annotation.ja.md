# 傾いた文字のアノテーションとIIIF画像切り出し

## はじめに

古地図や古文書には、様々な方向に傾いた文字が含まれています。本ツールでは、多角形（ポリゴン）アノテーションを使用して傾いた文字を正確にマークアップし、その傾き情報を活用してIIIF Image APIで回転補正された画像を取得できます。

## 傾き計算の仕組み

### 頂点の順序ルール

多角形アノテーションを作成する際、以下の順序で頂点を指定します：

1. **左上** → 2. **左下** → 3. **右下** → 4. **右上**

この反時計回りの順序を守ることで、傾き角度を一意に計算できます。

```
     左上(1) ─────────── 右上(4)
        │                   │
        │     文字領域      │
        │                   │
     左下(2) ─────────── 右下(3)
```

### 角度の計算方法

上辺（左上→右上）のベクトルから傾き角度を計算します：

```javascript
// SVGパスから頂点を抽出
// M x1,y1 L x2,y2 L x3,y3 L x4,y4 Z
// 頂点0(左上), 頂点1(左下), 頂点2(右下), 頂点3(右上)

const dx = 右上.x - 左上.x;  // 頂点3.x - 頂点0.x
const dy = 右上.y - 左上.y;  // 頂点3.y - 頂点0.y

const angle = Math.atan2(dy, dx) * (180 / Math.PI);

// IIIFの回転パラメータ（時計回りが正）
let iiifRotation = -angle;
if (iiifRotation < 0) iiifRotation += 360;
```

## 実際の使用例

### 例1: 横書きでほぼ水平な文字

**アノテーションデータ:**
```json
{
  "selector": [
    {
      "type": "FragmentSelector",
      "value": "xywh=9030,15590,1231,244"
    },
    {
      "type": "SvgSelector",
      "value": "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 9034.61 15828.17 L 10261.06 15835.12 L 10262.08 15596.18 L 9030.33 15590.72 Z\" /></svg>"
    }
  ]
}
```

**計算:**
```
左上: (9034.61, 15828.17)
右上: (9030.33, 15590.72)

dx = 9030.33 - 9034.61 = -4.28
dy = 15590.72 - 15828.17 = -237.45

angle = atan2(-237.45, -4.28) ≈ -91.0°
iiifRotation = 91°
```

**結果:**
- region: `9030,15590,1231,244`
- rotation: `91`

### 例2: 斜めに傾いた文字

**アノテーションデータ:**
```json
{
  "selector": [
    {
      "type": "FragmentSelector",
      "value": "xywh=8843,18773,320,365"
    },
    {
      "type": "SvgSelector",
      "value": "<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M 9064.97 19139.05 L 9163.98 18836.97 L 8944.30 18773.62 L 8843.73 19059.54 Z\" /></svg>"
    }
  ]
}
```

**計算:**
```
左上: (9064.97, 19139.05)
右上: (8843.73, 19059.54)

dx = 8843.73 - 9064.97 = -221.24
dy = 19059.54 - 19139.05 = -79.51

angle = atan2(-79.51, -221.24) ≈ -160.2°
iiifRotation = 160°
```

**結果:**
- region: `8843,18773,320,365`
- rotation: `160`

## IIIF Image APIでの画像取得

### URL構造

IIIF Image APIのURL構造：
```
{scheme}://{server}{/prefix}/{identifier}/{region}/{size}/{rotation}/{quality}.{format}
```

### 回転なしの画像

```
https://example.org/iiif/image/8843,18773,320,365/,200/0/default.png
```

### 傾き補正された画像

```
https://example.org/iiif/image/8843,18773,320,365/,200/160/default.png
```

### 透明背景で取得

回転により生じる余白を透明にするには、PNG形式を使用します：

```
https://example.org/iiif/image/8843,18773,320,365/,200/160/default.png
```

※ JPEG形式の場合、余白は白で埋められます。

### 回転機能の対応状況

IIIF Image APIの回転（rotation）機能は、すべての画像サーバーでサポートされているわけではありません。IIIF Image APIには以下のCompliance Levelが定義されています：

| Level | 回転機能 |
|-------|---------|
| Level 0 | 0度のみ対応 |
| Level 1 | 0度のみ対応 |
| Level 2 | 0, 90, 180, 270度に対応（任意角度はオプション） |

多くの画像サーバーはLevel 1またはLevel 2で運用されており、任意角度の回転に対応していない場合があります。対応状況は各画像サーバーの`info.json`で確認できます。

```json
{
  "profile": [
    "http://iiif.io/api/image/2/level2.json",
    {
      "supports": ["rotationArbitrary"]
    }
  ]
}
```

`rotationArbitrary`が含まれている場合のみ、任意角度の回転が可能です。

## IIIF Image Viewerでの表示

画像サーバーが回転に対応していない場合でも、[IIIF Image Viewer](https://nakamura196.github.io/iiif-image-viewer/)を使用することで、クライアント側で回転補正された画像を確認できます。このビューアはブラウザ上で画像を回転させるため、サーバー側の回転機能に依存しません。

### URLパラメータ

| パラメータ | 説明 | 例 |
|-----------|------|-----|
| iiif | IIIF Image APIのinfo.json URL | `https://example.org/iiif/image/info.json` |
| xywh | 切り出し領域（x,y,width,height） | `8843,18773,320,365` |
| rotation | 回転角度（度） | `160` |

### 使用例

[サンプル画像を開く](https://nakamura196.github.io/iiif-image-viewer/?iiif=https%3A%2F%2Fwww.digital.archives.go.jp%2Fapi%2Fiiif%2F001891947.tif%2Finfo.json&rotation=160&xywh=8843%2C18773%2C320%2C365)

## アノテーション作成のベストプラクティス

### 1. 頂点順序を守る

必ず「左上→左下→右下→右上」の順序で頂点を指定してください。この順序が崩れると、傾き計算が正しく行われません。

### 2. 文字の向きを意識する

文字の読み方向（上辺）が「左上→右上」の線になるようにアノテーションを作成します。

### 3. 適度な余白を含める

文字がちょうど収まる領域ではなく、少し余白を含めた方が視認性が向上します。

## 技術的な背景

### なぜFragmentSelectorとSvgSelectorの両方が必要か

- **FragmentSelector**: IIIF Image APIで画像を切り出すための境界ボックス（xywh）
- **SvgSelector**: 傾き計算のための正確な頂点座標

FragmentSelectorだけでは傾き情報が失われ、SvgSelectorだけでは境界ボックスの計算が必要になります。両方を保持することで、効率的な処理が可能になります。

### IIIF Image APIの回転について

IIIF Image APIの回転パラメータは：
- 時計回りが正の値
- 0〜360の範囲
- 小数点も使用可能

回転後の画像は、元の矩形より大きくなることがあります。これは、回転した矩形を包含する最小の軸平行矩形が返されるためです。

## 関連リソース

- [IIIF Image Viewer](https://nakamura196.github.io/iiif-image-viewer/)
- [IIIF Image API 仕様](https://iiif.io/api/image/3.0/)
- [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/)
