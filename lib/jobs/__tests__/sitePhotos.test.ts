import test from 'node:test'
import assert from 'node:assert/strict'
import {
  JOB_SITE_PHOTO_CATEGORIES,
  buildDriveFolderUrl,
  buildJobPhotoDriveFileName,
  deriveJobPhotoFolderName,
  getSafeJobPhotoExtension,
  isJobSitePhotoCategory,
  normalizeDriveFolderName,
} from '../sitePhotos.ts'

test('job site photo categories expose before damage and after', () => {
  assert.deepEqual(JOB_SITE_PHOTO_CATEGORIES, ['before', 'damage', 'after'])
})

test('isJobSitePhotoCategory accepts known categories and rejects unknown values', () => {
  assert.equal(isJobSitePhotoCategory('before'), true)
  assert.equal(isJobSitePhotoCategory('damage'), true)
  assert.equal(isJobSitePhotoCategory('after'), true)
  assert.equal(isJobSitePhotoCategory('during'), false)
  assert.equal(isJobSitePhotoCategory(null), false)
})

test('deriveJobPhotoFolderName prefers address then title then untitled fallback', () => {
  assert.equal(
    deriveJobPhotoFolderName({ customerAddress: '  123 Main St  ', title: 'Interior repaint' }),
    '123 Main St'
  )
  assert.equal(
    deriveJobPhotoFolderName({ customerAddress: '   ', title: '  Interior repaint  ' }),
    'Interior repaint'
  )
  assert.equal(deriveJobPhotoFolderName({ customerAddress: '   ', title: '\t\n' }), 'Untitled job')
})

test('normalizeDriveFolderName replaces Drive-hostile characters and normalizes separators', () => {
  const normalized = normalizeDriveFolderName('  123 / Main: * Bad?? "Name" <A> | B  ')

  assert.equal(normalized.includes('/'), false)
  assert.equal(normalized.includes(':'), false)
  assert.equal(normalized.includes('*'), false)
  assert.equal(normalized.includes('?'), false)
  assert.equal(normalized.includes('"'), false)
  assert.equal(normalized.includes('<'), false)
  assert.equal(normalized.includes('>'), false)
  assert.equal(normalized.includes('|'), false)
  assert.equal(normalized.includes('  '), false)
  assert.equal(normalized.includes('--'), false)
  assert.equal(normalizeDriveFolderName('Alpha---Beta////Gamma'), 'Alpha-Beta-Gamma')
})

test('getSafeJobPhotoExtension normalizes image extensions and falls back from MIME type', () => {
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.JPG', mimeType: 'image/jpeg' }), 'jpg')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.jpeg', mimeType: 'image/jpeg' }), 'jpg')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.png', mimeType: 'image/jpeg' }), 'png')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.webp', mimeType: 'image/jpeg' }), 'webp')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.heic', mimeType: 'image/jpeg' }), 'heic')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.heif', mimeType: 'image/jpeg' }), 'heif')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo', mimeType: 'image/png' }), 'png')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo', mimeType: 'image/webp' }), 'webp')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo', mimeType: 'image/heic' }), 'heic')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo', mimeType: 'image/heif' }), 'heif')
})

test('buildJobPhotoDriveFileName creates a deterministic UTC file name', () => {
  assert.equal(
    buildJobPhotoDriveFileName({
      capturedAt: '2026-04-28T15:04:05.000Z',
      category: 'damage',
      clientLocalId: 'abc-12345-xyz',
      originalName: 'Photo One.JPG',
      mimeType: 'image/jpeg',
    }),
    '2026-04-28_15-04-05_damage_abc-12345.jpg'
  )
})

test('buildDriveFolderUrl returns a Drive folder URL only when a folder id exists', () => {
  assert.equal(buildDriveFolderUrl('folder-123'), 'https://drive.google.com/drive/folders/folder-123')
  assert.equal(buildDriveFolderUrl(null), null)
})
