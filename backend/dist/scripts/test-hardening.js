import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateDescriptorMap } from '../services/descriptorValidationService.js';
import { enforceDisclosurePolicy } from '../services/policyEngine.js';
import { parseDisclosureToken, verifyDisclosures } from '../services/sdJwtDisclosureService.js';
function base64url(input) {
    return Buffer.from(input, 'utf-8').toString('base64url');
}
function run() {
    const presentationDefinition = {
        input_descriptors: [
            {
                id: 'bpjs-health-credential',
                constraints: {
                    fields: [
                        { path: ['$.holderName'] },
                        { path: ['$.nik'] },
                    ],
                },
            },
        ],
    };
    const vpPayload = {
        vp: {
            verifiableCredential: [
                {
                    type: ['VerifiableCredential', 'BPJSHealthCredential'],
                    credentialSubject: {
                        holderName: 'Budi',
                        nik: '3201',
                    },
                },
            ],
        },
    };
    // Case 1: valid descriptor_map
    const validDescriptor = validateDescriptorMap(presentationDefinition, { descriptor_map: [{ id: 'bpjs-health-credential', path: '$.vp.verifiableCredential[0]' }] }, vpPayload);
    assert.equal(validDescriptor.ok, true);
    // Case 1b: form-urlencoded OID4VP submissions can arrive as JSON strings, and
    // some wallets use a root path relative to the VP object.
    const stringDescriptor = validateDescriptorMap(presentationDefinition, JSON.stringify({ descriptor_map: [{ id: 'bpjs-health-credential', path: '$.verifiableCredential[0]' }] }), vpPayload);
    assert.equal(stringDescriptor.ok, true);
    // Case 2: invalid descriptor path
    const invalidDescriptor = validateDescriptorMap(presentationDefinition, { descriptor_map: [{ id: 'bpjs-health-credential', path: '$.vp.verifiableCredential[7]' }] }, vpPayload);
    assert.equal(invalidDescriptor.ok, false);
    assert.ok(invalidDescriptor.reasonCodes.includes('descriptor_path_invalid'));
    // Case 3: oversharing rejection
    const policyResult = enforceDisclosurePolicy(new Set(['holderName', 'nik']), { holderName: 'Budi', nik: '3201', tanggalLahir: '2000-01-01' }, {
        requireExactDisclosure: true,
        rejectOversharing: true,
        allowedAlgorithms: ['EdDSA'],
        requireAudienceMatch: true,
        requireNonceBinding: true,
        requireDescriptorMapValidation: true,
        requireKeyBindingForSdJwt: true,
        allowStatusCacheFallback: true,
        maxClockSkewSeconds: 60,
    }, 'jwt-vc');
    assert.equal(policyResult.ok, false);
    assert.ok(policyResult.extras.includes('tanggalLahir'));
    // Case 4: SD-JWT hash mismatch
    const disclosureRaw = JSON.stringify(['salt-1', 'holderName', 'Budi']);
    const disclosure = base64url(disclosureRaw);
    const parsed = parseDisclosureToken(disclosure);
    const mismatch = verifyDisclosures({ _sd_alg: 'sha-256', _sd: ['invalidDigest'] }, [parsed]);
    assert.equal(mismatch.ok, false);
    assert.ok(mismatch.reasonCodes.includes('disclosure_hash_mismatch'));
    // Case 5: valid SD-JWT hash
    const digest = crypto.createHash('sha256').update(disclosureRaw, 'utf8').digest('base64url');
    const validDisclosure = verifyDisclosures({ _sd_alg: 'sha-256', _sd: [digest] }, [parsed]);
    assert.equal(validDisclosure.ok, true);
    assert.equal(validDisclosure.claims.holderName, 'Budi');
    console.log('✅ Hardening tests passed (descriptor, disclosure, policy).');
}
run();
//# sourceMappingURL=test-hardening.js.map