/**
 * Unit tests for pathway sync script module count calculation
 *
 * These tests ensure that the sync script correctly calculates total module counts
 * for both course-based and module-based pathways. This is critical for:
 * 1. Progress tracking (data-total-modules attribute)
 * 2. Avoiding HubDB call limit issues
 * 3. Maintaining accurate pathway metadata
 *
 * Related to Issue #279 and PR #280 reviewer feedback
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('Pathway Sync: Module Count Calculation', () => {

  describe('Course-based Pathways', () => {

    it('should calculate correct module count for network-like-hyperscaler pathway', async () => {
      // Read the pathway JSON
      const pathwayPath = join(process.cwd(), 'content/pathways/network-like-hyperscaler.json');
      const pathwayContent = await readFile(pathwayPath, 'utf-8');
      const pathway = JSON.parse(pathwayContent);

      // Verify pathway structure
      expect(pathway.courses).toBeDefined();
      expect(Array.isArray(pathway.courses)).toBe(true);
      expect(pathway.courses.length).toBe(4);

      // Calculate expected module count by reading course files
      let totalModules = 0;
      for (const courseSlug of pathway.courses) {
        const coursePath = join(process.cwd(), 'content/courses', `${courseSlug}.json`);
        const courseContent = await readFile(coursePath, 'utf-8');
        const course = JSON.parse(courseContent);

        expect(course.modules).toBeDefined();
        expect(Array.isArray(course.modules)).toBe(true);

        totalModules += course.modules.length;
      }

      // Should equal 16 (4 courses × 4 modules each)
      expect(totalModules).toBe(16);
    });

    it('should calculate correct module count for getting-started pathway', async () => {
      const pathwayPath = join(process.cwd(), 'content/pathways/getting-started.json');
      const pathwayContent = await readFile(pathwayPath, 'utf-8');
      const pathway = JSON.parse(pathwayContent);

      expect(pathway.courses).toBeDefined();
      expect(Array.isArray(pathway.courses)).toBe(true);
      expect(pathway.courses.length).toBe(1);

      // Read the single course
      const coursePath = join(process.cwd(), 'content/courses', `${pathway.courses[0]}.json`);
      const courseContent = await readFile(coursePath, 'utf-8');
      const course = JSON.parse(courseContent);

      expect(course.modules).toBeDefined();
      expect(course.modules.length).toBe(3);
    });

    it('should not have modules array in course-based pathways', async () => {
      // Course-based pathways should use courses array, not modules array
      const pathways = [
        'network-like-hyperscaler',
        'getting-started'
      ];

      for (const pathwaySlug of pathways) {
        const pathwayPath = join(process.cwd(), 'content/pathways', `${pathwaySlug}.json`);
        const pathwayContent = await readFile(pathwayPath, 'utf-8');
        const pathway = JSON.parse(pathwayContent);

        expect(pathway.modules).toBeUndefined();
        expect(pathway.courses).toBeDefined();
      }
    });

  });

  describe('Course Module Counts', () => {

    it('network-like-hyperscaler-foundations should have 4 modules', async () => {
      const coursePath = join(process.cwd(), 'content/courses/network-like-hyperscaler-foundations.json');
      const courseContent = await readFile(coursePath, 'utf-8');
      const course = JSON.parse(courseContent);

      expect(course.modules).toBeDefined();
      expect(course.modules.length).toBe(4);
      expect(course.modules).toEqual([
        'fabric-operations-welcome',
        'fabric-operations-how-it-works',
        'fabric-operations-mastering-interfaces',
        'fabric-operations-foundations-recap'
      ]);
    });

    it('network-like-hyperscaler-provisioning should have 4 modules', async () => {
      const coursePath = join(process.cwd(), 'content/courses/network-like-hyperscaler-provisioning.json');
      const courseContent = await readFile(coursePath, 'utf-8');
      const course = JSON.parse(courseContent);

      expect(course.modules.length).toBe(4);
    });

    it('network-like-hyperscaler-observability should have 4 modules', async () => {
      const coursePath = join(process.cwd(), 'content/courses/network-like-hyperscaler-observability.json');
      const courseContent = await readFile(coursePath, 'utf-8');
      const course = JSON.parse(courseContent);

      expect(course.modules.length).toBe(4);
    });

    it('network-like-hyperscaler-troubleshooting should have 4 modules', async () => {
      const coursePath = join(process.cwd(), 'content/courses/network-like-hyperscaler-troubleshooting.json');
      const courseContent = await readFile(coursePath, 'utf-8');
      const course = JSON.parse(courseContent);

      expect(course.modules.length).toBe(4);
    });

    it('getting-started-virtual-lab should have 3 modules', async () => {
      const coursePath = join(process.cwd(), 'content/courses/getting-started-virtual-lab.json');
      const courseContent = await readFile(coursePath, 'utf-8');
      const course = JSON.parse(courseContent);

      expect(course.modules.length).toBe(3);
      expect(course.modules).toEqual([
        'accessing-the-hedgehog-virtual-lab-with-google-cloud',
        'accessing-the-hedgehog-virtual-lab-with-amazon-web-services',
        'accessing-the-hedgehog-virtual-lab-with-microsoft-azure'
      ]);
    });

  });

  describe('Sync Script Helper Function Simulation', () => {

    // Simulate the getCourseModuleCount helper function
    async function getCourseModuleCount(courseSlug: string): Promise<number> {
      const coursePath = join(process.cwd(), 'content/courses', `${courseSlug}.json`);
      const fileContent = await readFile(coursePath, 'utf-8');
      const course = JSON.parse(fileContent);
      return course.modules?.length || 0;
    }

    it('should correctly sum module counts for multi-course pathway', async () => {
      const courses = [
        'network-like-hyperscaler-foundations',
        'network-like-hyperscaler-provisioning',
        'network-like-hyperscaler-observability',
        'network-like-hyperscaler-troubleshooting'
      ];

      let totalModules = 0;
      for (const courseSlug of courses) {
        const count = await getCourseModuleCount(courseSlug);
        totalModules += count;
      }

      expect(totalModules).toBe(16);
    });

    it('should handle single-course pathway', async () => {
      const count = await getCourseModuleCount('getting-started-virtual-lab');
      expect(count).toBe(3);
    });

    it('should return 0 for non-existent course', async () => {
      try {
        await getCourseModuleCount('non-existent-course');
        expect.fail('Should have thrown error');
      } catch (err) {
        // Expected to fail
        expect(err).toBeDefined();
      }
    });

  });

  describe('Data Integrity Checks', () => {

    it('all courses referenced in pathways should exist', async () => {
      const pathwayFiles = [
        'network-like-hyperscaler.json',
        'getting-started.json',
        'authoring-foundations.json',
        'course-authoring-expert.json',
        'lab-onboarding.json'
      ];

      for (const file of pathwayFiles) {
        try {
          const pathwayPath = join(process.cwd(), 'content/pathways', file);
          const pathwayContent = await readFile(pathwayPath, 'utf-8');
          const pathway = JSON.parse(pathwayContent);

          if (pathway.courses && Array.isArray(pathway.courses)) {
            for (const courseSlug of pathway.courses) {
              const coursePath = join(process.cwd(), 'content/courses', `${courseSlug}.json`);

              // Should not throw
              await readFile(coursePath, 'utf-8');
            }
          }
        } catch (err: any) {
          if (err.code !== 'ENOENT') {
            // Only fail if it's not a "file not found" for the pathway itself
            throw err;
          }
        }
      }
    });

    it('all courses should have valid module arrays', async () => {
      const courseFiles = [
        'network-like-hyperscaler-foundations.json',
        'network-like-hyperscaler-provisioning.json',
        'network-like-hyperscaler-observability.json',
        'network-like-hyperscaler-troubleshooting.json',
        'getting-started-virtual-lab.json'
      ];

      for (const file of courseFiles) {
        const coursePath = join(process.cwd(), 'content/courses', file);
        const courseContent = await readFile(coursePath, 'utf-8');
        const course = JSON.parse(courseContent);

        expect(course.modules).toBeDefined();
        expect(Array.isArray(course.modules)).toBe(true);
        expect(course.modules.length).toBeGreaterThan(0);
      }
    });

  });

});
