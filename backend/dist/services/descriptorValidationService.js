export function validateDescriptorMap(presentationDefinition, presentationSubmission, vpPayload) {
    const reasonCodes = [];
    const mappings = [];
    const descriptors = getInputDescriptors(presentationDefinition);
    const descriptorMap = getDescriptorMap(presentationSubmission);
    if (!descriptors.length) {
        return { ok: true, reasonCodes: [], mappings: [] };
    }
    if (!descriptorMap.length) {
        return {
            ok: false,
            reasonCodes: ['presentation_definition_mismatch'],
            mappings: descriptors.map((d) => ({
                descriptorId: d.id,
                path: '',
                matched: false,
                error: 'descriptor_map_missing',
            })),
        };
    }
    const mapById = new Map(descriptorMap.map((item) => [item.id, item]));
    for (const descriptor of descriptors) {
        const item = mapById.get(descriptor.id);
        if (!item) {
            reasonCodes.push('presentation_definition_mismatch');
            mappings.push({
                descriptorId: descriptor.id,
                path: '',
                matched: false,
                error: 'descriptor_not_provided',
            });
            continue;
        }
        const pathInfo = parseCredentialPath(item.path);
        if (!pathInfo.valid) {
            reasonCodes.push('descriptor_path_invalid');
            mappings.push({
                descriptorId: descriptor.id,
                path: item.path,
                matched: false,
                error: 'unsupported_path',
            });
            continue;
        }
        const credential = resolveCredentialByPath(vpPayload, pathInfo.index, pathInfo.scope);
        if (!credential) {
            reasonCodes.push('descriptor_path_invalid');
            mappings.push({
                descriptorId: descriptor.id,
                path: item.path,
                matched: false,
                error: 'credential_not_found',
            });
            continue;
        }
        const formatMatch = matchDescriptorFormat(descriptor.raw, item.format);
        if (!formatMatch.ok) {
            reasonCodes.push('presentation_definition_mismatch');
            mappings.push({
                descriptorId: descriptor.id,
                path: item.path,
                matched: false,
                credentialIndex: pathInfo.index,
                error: formatMatch.error,
            });
            continue;
        }
        const typeMatch = matchDescriptorType(descriptor.raw, credential);
        if (!typeMatch) {
            reasonCodes.push('descriptor_credential_mismatch');
            mappings.push({
                descriptorId: descriptor.id,
                path: item.path,
                matched: false,
                credentialIndex: pathInfo.index,
                error: 'type_mismatch',
            });
            continue;
        }
        mappings.push({
            descriptorId: descriptor.id,
            path: item.path,
            matched: true,
            credentialIndex: pathInfo.index,
        });
    }
    return {
        ok: reasonCodes.length === 0,
        reasonCodes: Array.from(new Set(reasonCodes)),
        mappings,
    };
}
function getInputDescriptors(presentationDefinition) {
    if (!presentationDefinition || typeof presentationDefinition !== 'object')
        return [];
    const pd = presentationDefinition;
    const inputDescriptors = pd.input_descriptors;
    if (!Array.isArray(inputDescriptors))
        return [];
    return inputDescriptors
        .filter((descriptor) => descriptor && typeof descriptor === 'object')
        .map((descriptor) => {
        const raw = descriptor;
        return {
            id: String(raw.id || ''),
            raw,
        };
    })
        .filter((descriptor) => descriptor.id.length > 0);
}
function getDescriptorMap(presentationSubmission) {
    const normalizedSubmission = normalizePresentationSubmission(presentationSubmission);
    if (!normalizedSubmission || typeof normalizedSubmission !== 'object')
        return [];
    const ps = normalizedSubmission;
    const map = ps.descriptor_map;
    if (!Array.isArray(map))
        return [];
    return map
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
        const asRecord = item;
        return {
            id: String(asRecord.id || ''),
            path: String(asRecord.path || ''),
            format: typeof asRecord.format === 'string' ? asRecord.format : undefined,
        };
    })
        .filter((item) => item.id.length > 0 && item.path.length > 0);
}
function normalizePresentationSubmission(presentationSubmission) {
    if (typeof presentationSubmission !== 'string')
        return presentationSubmission;
    try {
        return JSON.parse(presentationSubmission);
    }
    catch {
        return presentationSubmission;
    }
}
function parseCredentialPath(path) {
    if (path === '$.vp.verifiableCredential[0]') {
        return { valid: true, index: 0, scope: 'vp' };
    }
    if (path === '$.verifiableCredential[0]') {
        return { valid: true, index: 0, scope: 'root' };
    }
    const match = /^\$\.vp\.verifiableCredential\[(\d+)\]$/.exec(path);
    if (match)
        return { valid: true, index: Number(match[1]), scope: 'vp' };
    const rootMatch = /^\$\.verifiableCredential\[(\d+)\]$/.exec(path);
    if (rootMatch)
        return { valid: true, index: Number(rootMatch[1]), scope: 'root' };
    return { valid: false, index: -1, scope: 'vp' };
}
function resolveCredentialByPath(vpPayload, index, scope) {
    const source = scope === 'root'
        ? vpPayload
        : vpPayload.vp;
    const vc = source?.verifiableCredential;
    if (!Array.isArray(vc) && scope === 'root') {
        const nestedVp = vpPayload.vp;
        const nestedVc = nestedVp?.verifiableCredential;
        if (Array.isArray(nestedVc))
            return nestedVc[index] ?? null;
    }
    if (!Array.isArray(vc))
        return null;
    return vc[index] ?? null;
}
function matchDescriptorType(descriptor, credential) {
    const constraints = descriptor.constraints;
    const fields = constraints?.fields;
    if (!Array.isArray(fields) || fields.length === 0)
        return true;
    const typeConst = fields
        .map((field) => field.filter)
        .map((filter) => filter?.const)
        .find((value) => typeof value === 'string');
    if (!typeConst)
        return true;
    if (typeof credential === 'string') {
        // For compact JWT/SD-JWT credential, descriptor type check deferred to VC payload validation.
        return true;
    }
    if (credential && typeof credential === 'object') {
        const cred = credential;
        const types = cred.type;
        if (Array.isArray(types))
            return types.includes(typeConst);
        if (typeof types === 'string')
            return types === typeConst;
    }
    return false;
}
function matchDescriptorFormat(descriptor, submissionFormat) {
    if (!submissionFormat)
        return { ok: true };
    const descriptorFormat = descriptor.format;
    if (!descriptorFormat || typeof descriptorFormat !== 'object') {
        return { ok: true };
    }
    const allowed = Object.keys(descriptorFormat);
    if (!allowed.length)
        return { ok: true };
    const normalizedSubmission = normalizeFormatName(submissionFormat);
    const normalizedAllowed = new Set(allowed.map((fmt) => normalizeFormatName(fmt)));
    if (normalizedAllowed.has(normalizedSubmission)) {
        return { ok: true };
    }
    return {
        ok: false,
        error: `format_mismatch:${submissionFormat}`,
    };
}
function normalizeFormatName(format) {
    const normalized = format.trim().toLowerCase();
    if (normalized === 'jwt_vp_json')
        return 'jwt_vp';
    return normalized;
}
//# sourceMappingURL=descriptorValidationService.js.map