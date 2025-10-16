#!/usr/bin/env ts-node
"use strict";
/**
 * Debug path matching between courses/pathways and their referenced modules/courses
 *
 * The templates use queries like: path__eq=<slug>
 * This script checks if the 'path' (hs_path) field matches the slugs stored in JSON fields
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const api_client_1 = require("@hubspot/api-client");
const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!TOKEN) {
    console.error('❌ HUBSPOT_PRIVATE_APP_TOKEN environment variable not set');
    process.exit(1);
}
const client = new api_client_1.Client({ accessToken: TOKEN });
async function debugCourse() {
    const coursesTableId = process.env.HUBDB_COURSES_TABLE_ID;
    const modulesTableId = process.env.HUBDB_MODULES_TABLE_ID;
    console.log('\n' + '='.repeat(60));
    console.log('🔍 DEBUGGING COURSE: Course Authoring 101');
    console.log('='.repeat(60));
    if (!coursesTableId || !modulesTableId) {
        console.log('⚠️  Missing table IDs');
        return;
    }
    // Get the course
    const coursesResponse = await client.cms.hubdb.rowsApi.getTableRows(coursesTableId);
    const courses = coursesResponse.results || [];
    const course = courses.find((c) => c.path === 'course-authoring-101');
    if (!course) {
        console.log('❌ Course not found');
        return;
    }
    console.log(`\nCourse: ${course.name}`);
    console.log(`hs_path (row.path): ${course.path}`);
    const moduleSlugsjson = course.values.module_slugs_json;
    console.log(`\nModule slugs JSON: ${moduleSlugsjson ? 'Present' : 'Empty'}`);
    if (moduleSlugsjson) {
        const moduleSlugs = JSON.parse(moduleSlugsjson);
        console.log(`Module slugs: ${JSON.stringify(moduleSlugs)}`);
        console.log(`\n🔍 Checking each module slug:`);
        for (const slug of moduleSlugs) {
            console.log(`\n  Slug: "${slug}"`);
            // Try the exact query the template uses
            const query = `path__eq=${slug}&tags__not__icontains=archived`;
            console.log(`  Query: ${query}`);
            try {
                // Get all modules and filter manually since query syntax is tricky
                const moduleResponse = await client.cms.hubdb.rowsApi.getTableRows(modulesTableId, undefined, undefined, undefined);
                const allModules = moduleResponse.results || [];
                const modules = allModules.filter((m) => m.path === slug && !m.values.tags?.toLowerCase().includes('archived'));
                console.log(`  Results: ${modules.length} module(s) found`);
                if (modules.length === 0) {
                    // Try to find the module without the path filter
                    const allModulesResponse = await client.cms.hubdb.rowsApi.getTableRows(modulesTableId);
                    const allModules = allModulesResponse.results || [];
                    const matchingModule = allModules.find((m) => m.path === slug);
                    if (matchingModule) {
                        console.log(`  ⚠️  Module exists but path doesn't match!`);
                        console.log(`      Module hs_path: "${matchingModule.path}"`);
                        console.log(`      Looking for: "${slug}"`);
                    }
                    else {
                        console.log(`  ❌ Module not found at all`);
                    }
                }
                else {
                    console.log(`  ✅ Module found: ${modules[0].name}`);
                    console.log(`      hs_path: "${modules[0].path}"`);
                }
            }
            catch (err) {
                console.log(`  ❌ Error: ${err.message}`);
            }
        }
    }
}
async function debugPathway() {
    const pathwaysTableId = process.env.HUBDB_PATHWAYS_TABLE_ID;
    const coursesTableId = process.env.HUBDB_COURSES_TABLE_ID;
    console.log('\n' + '='.repeat(60));
    console.log('🔍 DEBUGGING PATHWAY: Course Authoring Expert');
    console.log('='.repeat(60));
    if (!pathwaysTableId || !coursesTableId) {
        console.log('⚠️  Missing table IDs');
        return;
    }
    // Get the pathway
    const pathwaysResponse = await client.cms.hubdb.rowsApi.getTableRows(pathwaysTableId);
    const pathways = pathwaysResponse.results || [];
    const pathway = pathways.find((p) => p.path === 'course-authoring-expert');
    if (!pathway) {
        console.log('❌ Pathway not found');
        return;
    }
    console.log(`\nPathway: ${pathway.name}`);
    console.log(`hs_path (row.path): ${pathway.path}`);
    const courseSlugsJson = pathway.values.course_slugs_json;
    console.log(`\nCourse slugs JSON: ${courseSlugsJson ? 'Present' : 'Empty'}`);
    if (courseSlugsJson) {
        const courseSlugs = JSON.parse(courseSlugsJson);
        console.log(`Course slugs: ${JSON.stringify(courseSlugs)}`);
        console.log(`\n🔍 Checking each course slug:`);
        for (const slug of courseSlugs) {
            console.log(`\n  Slug: "${slug}"`);
            // Try the exact query the template uses
            const query = `path__eq=${slug}&tags__not__icontains=archived`;
            console.log(`  Query: ${query}`);
            try {
                // Get all courses and filter manually since query syntax is tricky
                const courseResponse = await client.cms.hubdb.rowsApi.getTableRows(coursesTableId, undefined, undefined, undefined);
                const allCourses = courseResponse.results || [];
                const courses = allCourses.filter((c) => c.path === slug && !c.values.tags?.toLowerCase().includes('archived'));
                console.log(`  Results: ${courses.length} course(s) found`);
                if (courses.length === 0) {
                    // Try to find the course without the path filter
                    const allCoursesResponse = await client.cms.hubdb.rowsApi.getTableRows(coursesTableId);
                    const allCourses = allCoursesResponse.results || [];
                    const matchingCourse = allCourses.find((c) => c.path === slug);
                    if (matchingCourse) {
                        console.log(`  ⚠️  Course exists but path doesn't match!`);
                        console.log(`      Course hs_path: "${matchingCourse.path}"`);
                        console.log(`      Looking for: "${slug}"`);
                    }
                    else {
                        console.log(`  ❌ Course not found at all`);
                    }
                }
                else {
                    console.log(`  ✅ Course found: ${courses[0].name}`);
                    console.log(`      hs_path: "${courses[0].path}"`);
                }
            }
            catch (err) {
                console.log(`  ❌ Error: ${err.message}`);
            }
        }
    }
}
async function main() {
    console.log('🔍 Debugging Path Matching in HubDB...\n');
    await debugCourse();
    await debugPathway();
    console.log('\n' + '='.repeat(60));
    console.log('✅ Debug complete!');
    console.log('='.repeat(60));
}
main().catch(err => {
    console.error('❌ Debug failed:', err);
    process.exit(1);
});
