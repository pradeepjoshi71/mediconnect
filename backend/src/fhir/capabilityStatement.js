/**
 * capabilityStatement.js
 *
 * Builds a FHIR R4 CapabilityStatement for the MediConnect FHIR server.
 * Returned by GET /api/fhir/metadata (no auth required).
 * Spec: https://hl7.org/fhir/R4/capabilitystatement.html
 */
'use strict';

function buildCapabilityStatement(baseUrl) {
  const now = new Date().toISOString();

  return {
    resourceType: 'CapabilityStatement',
    id:           'mediconnect-fhir-capability',
    url:          `${baseUrl}/api/fhir/metadata`,
    version:      '6.1.0',
    name:         'MediConnectFHIRCapabilityStatement',
    title:        'MediConnect FHIR R4 Server',
    status:       'active',
    date:          now,
    publisher:    'MediConnect',
    description:  'FHIR R4 capability statement for the MediConnect clinical data API. Supports Patient, Practitioner, Appointment, and Encounter resources with multi-tenant isolation.',
    kind:         'instance',
    software: {
      name:    'MediConnect',
      version: '6.1.0',
    },
    implementation: {
      description: 'MediConnect Hospital Management System — FHIR R4 Layer',
      url:          `${baseUrl}/api/fhir`,
    },
    fhirVersion:  '4.0.1',
    format:       ['json'],
    rest: [{
      mode:          'server',
      documentation: 'All resources require Bearer token authentication. Resource IDs are tenant-scoped: <hospitalId>-<internalId>.',
      security: {
        cors:        true,
        description: 'OAuth 2.0 Bearer token (JWT). Obtain via POST /api/v1/auth/login.',
        service: [{
          coding: [{
            system:  'http://terminology.hl7.org/CodeSystem/restful-security-service',
            code:    'OAuth',
            display: 'OAuth',
          }],
        }],
      },
      resource: [
        _resourceEntry('Patient', baseUrl, ['read', 'create'], {
          description: 'FHIR R4 Patient mapped from MediConnect patient profiles.',
          searchParam:  [],
        }),
        _resourceEntry('Practitioner', baseUrl, ['read', 'create'], {
          description: 'FHIR R4 Practitioner mapped from MediConnect doctor profiles.',
          searchParam:  [],
        }),
        _resourceEntry('Appointment', baseUrl, ['read', 'create'], {
          description: 'FHIR R4 Appointment mapped from MediConnect appointment records.',
          searchParam:  [],
        }),
        _resourceEntry('Encounter', baseUrl, ['read', 'create'], {
          description: 'FHIR R4 Encounter mapped from MediConnect medical records (clinical notes).',
          searchParam:  [],
        }),
      ],
    }],
  };
}

function _resourceEntry(type, baseUrl, interactions, { description, searchParam }) {
  return {
    type,
    profile:     `http://hl7.org/fhir/StructureDefinition/${type}`,
    documentation: description,
    interaction:   interactions.map(code => ({ code })),
    versioning:   'no-version',
    readHistory:   false,
    updateCreate:  false,
    conditionalCreate: false,
    conditionalRead:   'not-supported',
    conditionalUpdate: false,
    conditionalDelete: 'not-supported',
    searchParam: searchParam || [],
  };
}

module.exports = { buildCapabilityStatement };
