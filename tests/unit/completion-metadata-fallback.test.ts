describe('completion metadata fallback', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock('fs');
  });

  it('hydrates course/pathway metadata from compiled fallback when filesystem content is unavailable', () => {
    jest.doMock('fs', () => ({
      __esModule: true,
      default: {
        existsSync: jest.fn().mockReturnValue(false),
        readdirSync: jest.fn(),
        readFileSync: jest.fn(),
      },
    }));

    jest.isolateModules(() => {
      const completion = require('../../src/api/lambda/completion');

      expect(completion.getCourseMetadata('network-like-hyperscaler-foundations')).toEqual(
        expect.objectContaining({
          slug: 'network-like-hyperscaler-foundations',
          title: 'Course 1: Foundations & Interfaces',
          modules: [
            'fabric-operations-welcome',
            'fabric-operations-how-it-works',
            'fabric-operations-mastering-interfaces',
            'fabric-operations-foundations-recap',
          ],
        })
      );

      expect(completion.getPathwayMetadata('network-like-hyperscaler')).toEqual(
        expect.objectContaining({
          slug: 'network-like-hyperscaler',
          title: 'Network Like a Hyperscaler',
          courses: [
            'network-like-hyperscaler-foundations',
            'network-like-hyperscaler-provisioning',
            'network-like-hyperscaler-observability',
            'network-like-hyperscaler-troubleshooting',
          ],
        })
      );

      expect(completion.listAllCourseSlugs()).toEqual(
        expect.arrayContaining([
          'hedgehog-lab-foundations',
          'network-like-hyperscaler-foundations',
          'network-like-hyperscaler-provisioning',
          'network-like-hyperscaler-observability',
          'network-like-hyperscaler-troubleshooting',
        ])
      );
      expect(completion.listAllPathwaySlugs()).toEqual(['network-like-hyperscaler']);
    });
  });
});
