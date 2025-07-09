require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const HierarchyService = require('./services/hierarchyService');
const db = require('./db/database');

const HOST = process.env.HOST ;
const app = express();
const PORT = process.env.PORT || 5002;  

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/hierarchies/check-project', async (req, res) => {
    try {
        const { company, project, location } = req.query;
        if (!company || !project) {
            return res.status(400).json({ error: 'Company and project query parameters are required' });
        }
        console.log(`Checking for project: company=${company}, project=${project}, location=${location}`);
        const result = await HierarchyService.findProjectByName(company, project, location);
        if (!result) {
            return res.status(404).json({ message: 'No project found with that name.' });
        }
        res.json(result);
    } catch (error) {
        console.error('Error checking for project:', error);
        res.status(500).json({ error: error.message });
    }
});

// New endpoint to check for any hierarchies for a company (approved or in-draft)
app.get('/api/hierarchies/check-company', async (req, res) => {
    try {
        const { company } = req.query;
        if (!company) {
            return res.status(400).json({ error: 'Company query parameter is required' });
        }
        const results = await HierarchyService.findHierarchiesByCompany(company);
        if (!results || results.length === 0) {
            return res.status(404).json({ message: 'No hierarchies found for that company.' });
        }
        res.json(results);
    } catch (error) {
        console.error('Error checking for company hierarchies:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/hierarchies', async (req, res) => {
  try {
    const { userInput, data, projectName, createNew = false } = req.body;
    if (!userInput || !userInput.company || !data || !projectName) {
      return res.status(400).json({ error: 'userInput (with company), data, and projectName are required' });
    }
    const result = await HierarchyService.createInitialHierarchy({ userInput, data, projectName, createNew });
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating initial hierarchy:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hierarchies/:id/versions', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, userFeedback } = req.body;
        if (!data) {
            return res.status(400).json({ error: 'New hierarchy data is required' });
        }
        const result = await HierarchyService.createNewVersion({ parentId: id, data, userFeedback });
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating new version:', error);
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/hierarchies/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await HierarchyService.approveHierarchy(id);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error approving hierarchy:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/hierarchies/grouped', async (req, res) => {
    try {
        const grouped = await HierarchyService.getAllHierarchiesGrouped();
        res.json(grouped);
    } catch (error) {
        console.error('Error fetching grouped hierarchies:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fuzzy entity search endpoint
app.get('/api/hierarchies/fuzzy-entity-search', async (req, res) => {
  try {
    const { entity } = req.query;
    if (!entity) {
      return res.status(400).json({ error: 'Entity query parameter is required' });
    }
    const results = await HierarchyService.fuzzySearchEntity(entity);
    if (!results || results.length === 0) {
      return res.status(404).json({ message: 'No hierarchies found containing that entity.' });
    }
    res.json(results);
  } catch (error) {
    console.error('Error in fuzzy entity search:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hierarchies/:id', async (req, res) => {
  try {
    const hierarchy = await HierarchyService.getHierarchy(req.params.id);
    if (!hierarchy) {
      return res.status(404).json({ error: 'Hierarchy not found' });
    }
    res.json(hierarchy);
  } catch (error) {
    console.error('Error getting hierarchy:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH: update M&A data and clear flag
app.patch('/api/hierarchies/:id/ma-update', async (req, res) => {
  try {
    const { id } = req.params;
    const { newMAData } = req.body;
    const result = await HierarchyService.updateMAData(id, newMAData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: check M&A update status
app.get('/api/hierarchies/:id/ma-status', async (req, res) => {
  try {
    const { id } = req.params;
    const status = await HierarchyService.getMAStatus(id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, async () => {
  try {
    await db.query('SELECT NOW()');
    console.log(`Server is running on localhost:${PORT}`);
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
});

module.exports = app;