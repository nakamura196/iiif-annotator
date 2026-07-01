// アノテーション API の OpenAPI 3.0 定義。
// /api/openapi で配信し、/api-docs の Swagger UI から参照する。
// 値はビルド時静的（実行時に変わる要素は server 変数のみ）。

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'IIIF Annotator API',
    version: '1.0.0',
    description:
      'IIIF アノテーションの取得・作成・更新・削除 API。\n\n' +
      '認証は次のいずれか:\n' +
      '- `X-API-Key`: 外部/サーバ用（設定画面で発行した API キー）\n' +
      '- `Authorization: Bearer <Firebase ID token>`: ブラウザ（ログイン中ユーザ）用\n\n' +
      '作成・更新・削除はいずれも「認証ユーザ自身のアノテーション」に対してのみ可能。',
  },
  servers: [{ url: '/', description: 'current origin' }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token' },
    },
    schemas: {
      MetadataPair: {
        type: 'object',
        properties: { label: { type: 'string' }, value: { type: 'string' } },
        required: ['label', 'value'],
      },
      AnnotationInput: {
        type: 'object',
        properties: {
          manifestId: { type: 'string', description: 'IIIF Manifest URL' },
          canvasId: { type: 'string', description: 'IIIF Canvas URL' },
          motivation: { type: 'string', default: 'commenting' },
          type: { type: 'string', default: 'Annotation' },
          body: {
            type: 'object',
            properties: { type: { type: 'string' }, value: { type: 'string' } },
          },
          target: {
            type: 'object',
            description: 'W3C/IIIF target（selector を含む）',
          },
          metadata: { type: 'array', items: { $ref: '#/components/schemas/MetadataPair' } },
        },
        required: ['manifestId', 'canvasId', 'target'],
      },
      Annotation: {
        allOf: [
          { $ref: '#/components/schemas/AnnotationInput' },
          {
            type: 'object',
            properties: {
              id: { type: 'string' },
              userId: { type: 'string' },
              userName: { type: 'string', nullable: true },
              created: { type: 'string', format: 'date-time', nullable: true },
              modified: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        ],
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
  paths: {
    '/api/annotations': {
      get: {
        summary: '指定 manifest 群のアノテーションを取得',
        parameters: [
          {
            name: 'manifestIds',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'カンマ区切りの Manifest URL',
          },
          {
            name: 'canvasId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description:
              'IIIF Canvas URL。manifestIds が単一のとき指定すると、その canvas のアノテーションだけを返す（読み取り量を抑える）',
          },
          {
            name: 'format',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['iiif'] },
            description: 'iiif を指定すると IIIF Manifest 形式で返す',
          },
        ],
        responses: {
          '200': { description: 'OK' },
          '400': {
            description: 'manifestIds 未指定',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': { description: '未認証' },
        },
      },
      post: {
        summary: 'アノテーションを作成',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AnnotationInput' } },
          },
        },
        responses: {
          '201': {
            description: '作成成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { annotation: { $ref: '#/components/schemas/Annotation' } },
                },
              },
            },
          },
          '400': {
            description: '検証エラー',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': { description: '未認証' },
          '503': {
            description: 'メンテナンス中（書き込み一時停止）',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/annotations/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        summary: '単一アノテーションを取得',
        responses: {
          '200': { description: 'OK' },
          '404': { description: '存在しない' },
        },
      },
      put: {
        summary: 'アノテーションを更新（作成者のみ）',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AnnotationInput' } },
          },
        },
        responses: {
          '200': {
            description: '更新成功',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { annotation: { $ref: '#/components/schemas/Annotation' } },
                },
              },
            },
          },
          '400': { description: '検証エラー' },
          '401': { description: '未認証' },
          '403': { description: '所有者でない' },
          '404': { description: '存在しない' },
          '503': { description: 'メンテナンス中（書き込み一時停止）' },
        },
      },
      delete: {
        summary: 'アノテーションを削除（作成者のみ）',
        responses: {
          '200': { description: '削除成功' },
          '401': { description: '未認証' },
          '403': { description: '所有者でない' },
          '404': { description: '存在しない' },
          '503': { description: 'メンテナンス中（書き込み一時停止）' },
        },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
