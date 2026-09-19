import { CmsService } from '../src/cms/cms.service'

describe('Public media publication boundary', () => {
  function setup(snapshots: unknown[]) {
    const prisma = {
      cmsContent: {
        findMany: jest
          .fn()
          .mockResolvedValue(snapshots.map((snapshot) => ({ livePublication: { snapshot } }))),
      },
    }
    const storage = { getSignedUrl: jest.fn().mockResolvedValue('https://media.example/published') }
    const service = Object.assign(Object.create(CmsService.prototype), {
      prisma,
      storage,
    }) as CmsService
    return { service, prisma, storage }
  }
  it('does not sign a known private key without an active publication', async () => {
    const { service, storage, prisma } = setup([])
    await expect(service.publicMediaUrl('tenant-a', 'tenant-a/private.pdf')).rejects.toMatchObject({
      kind: 'NOT_FOUND',
    })
    expect(storage.getSignedUrl).not.toHaveBeenCalled()
    expect(prisma.cmsContent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          state: 'PUBLISHED',
          livePublication: { is: { unpublishedAt: null } },
        },
      }),
    )
  })
  it.each([
    { featuredImage: { storageKey: 'tenant-a/image' } },
    { media: [{ storageKey: 'tenant-a/image' }] },
    { slots: { hero: { storageKey: 'tenant-a/image' } } },
  ])('signs an image referenced by a published snapshot: %j', async (snapshot) => {
    const { service, storage } = setup([snapshot])
    await expect(service.publicMediaUrl('tenant-a', 'tenant-a/image')).resolves.toHaveProperty(
      'url',
    )
    expect(storage.getSignedUrl).toHaveBeenCalledWith('tenant-a', 'tenant-a/image')
  })
  it('does not authorize a key mentioned in body copy or another key', async () => {
    const { service, storage } = setup([
      { body: 'tenant-a/private.pdf', featuredImage: { storageKey: 'tenant-a/public' } },
    ])
    await expect(service.publicMediaUrl('tenant-a', 'tenant-a/private.pdf')).rejects.toMatchObject({
      kind: 'NOT_FOUND',
    })
    expect(storage.getSignedUrl).not.toHaveBeenCalled()
  })
})
describe('Authenticated library media preview', () => {
  it.each([
    ['SETTINGS', 'media-library', true],
    ['SETTINGS', 'other-settings', false],
    ['PAGE', 'media-library', false],
  ])('limits library items to the designated document: %s/%s', async (kind, slug, allowed) => {
    const prisma = {
      cmsContent: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            kind,
            slug,
            draft: { items: [{ id: 'image-1', storageKey: 'tenant-a/photo' }] },
          }),
      },
    }
    const storage = { getSignedUrl: jest.fn().mockResolvedValue('signed-url') }
    const service = Object.assign(Object.create(CmsService.prototype), {
      prisma,
      storage,
    }) as CmsService
    const result = service.projectMediaUrl('tenant-a', 'library-id', 'image-1')
    if (allowed) await expect(result).resolves.toEqual({ url: 'signed-url' })
    else {
      await expect(result).rejects.toMatchObject({ kind: 'NOT_FOUND' })
      expect(storage.getSignedUrl).not.toHaveBeenCalled()
    }
    expect(prisma.cmsContent.findFirst).toHaveBeenCalledWith({
      where: { id: 'library-id', tenantId: 'tenant-a' },
    })
  })
})
