const HierarchyRepository = require('../db/repositories/hierarchyRepository');
const db = require('../db/database.js');

class HierarchyService {

    static async findProjectByName(company, project, location) {
        return await HierarchyRepository.findProjectByName(company, project, location);
    }

    static async createInitialHierarchy({ userInput, data, projectName, createNew = false }) {
        if (!userInput || !userInput.company) {
            throw new Error('Company is required in userInput');
        }
        if (!data) {
            throw new Error('Data is required');
        }
        if (!projectName) {
            throw new Error('Project name is required');
        }

        try {
            // If createNew is true, archive the existing draft for this project.
            if (createNew) {
                await HierarchyRepository.archiveDraftProject(userInput.company, projectName, userInput.location);
            }

            const metadata = await HierarchyRepository.createMetadata({
                userInput,
                projectName,
                status: 'in-draft',
                version: 'v0',
                version_number: 0,
            });

            const dataEntry = await HierarchyRepository.createData(metadata.id, data);

            return { metadata, data: dataEntry };
        } catch (error) {
            console.error('Error in createInitialHierarchy:', error);
            throw error;
        }
    }

    static async createNewVersion({ parentId, data, userFeedback }) {
        const parentMetadata = await HierarchyRepository.getMetadataById(parentId);
        if (!parentMetadata) {
            throw new Error('Parent hierarchy not found');
        }

        await HierarchyRepository.updateMetadata(parentId, { is_active_draft: false });

        const root_hierarchy_id = parentMetadata.root_hierarchy_id || parentMetadata.id;
        const version_number = parentMetadata.version_number + 1;
        const version = `v${version_number}`;

        const newMetadata = await HierarchyRepository.createMetadata({
            userInput: parentMetadata.user_input,
            projectName: parentMetadata.project_name,
            status: 'in-draft',
            version,
            userFeedback: userFeedback ? { text: userFeedback } : null,
            root_hierarchy_id,
            version_number,
        });

        const newData = await HierarchyRepository.createData(newMetadata.id, data);

        return { metadata: newMetadata, data: newData };
    }

    static async approveHierarchy(id) {
        const metadataToApprove = await HierarchyRepository.getMetadataById(id);
        if (!metadataToApprove) {
            throw new Error('Hierarchy to approve not found');
        }

        const rootId = metadataToApprove.root_hierarchy_id || metadataToApprove.id;
        
        await HierarchyRepository.archiveHierarchyChain(rootId, id);

        const approvedMetadata = await HierarchyRepository.updateMetadata(id, {
            status: 'approved',
            is_active_draft: false,
        });

        return approvedMetadata;
    }

    static async getHierarchy(metadataId) {
        const metadata = await HierarchyRepository.getMetadataById(metadataId);
        if (!metadata) {
            throw new Error('Hierarchy not found');
        }
        const data = await HierarchyRepository.getDataByMetadataId(metadataId);
        return { metadata, data };
    }

    static async getAllHierarchiesGrouped() {
        return await HierarchyRepository.getAllHierarchiesGrouped();
    }

    static async findHierarchiesByCompany(company) {
        return await HierarchyRepository.findHierarchiesByCompany(company);
    }

    static async fuzzySearchEntity(entityName) {
        return await HierarchyRepository.fuzzySearchEntity(entityName);
    }

    // Get all in-draft/approved hierarchies for M&A update check
    static async getAllHierarchiesForMAUpdate() {
        const result = await HierarchyRepository.getAllHierarchiesForMAUpdate();
        return result.rows;
    }

    // Update M&A data and clear update flag
    static async updateMAData(id, newHierarchyData) {
        const result = await db.query(
            `UPDATE hierarchy_data SET data = $1, updated_at = NOW() WHERE metadata_id = $2 RETURNING *`,
            [JSON.stringify(newHierarchyData), id]
        );
        return { success: true, updated: result.rows[0] };
    }

    // Get M&A update status for a hierarchy
    static async getMAStatus(id) {
        const result = await HierarchyRepository.getMAStatus(id);
        return result.rows[0];
    }
}

module.exports = HierarchyService;