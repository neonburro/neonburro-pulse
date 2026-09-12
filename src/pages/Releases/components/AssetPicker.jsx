// src/pages/Releases/components/AssetPicker.jsx
// SENTINEL: NB_PULSE_RELEASES_ASSETS_V1
//
// The picture shelf for one release. It lists the objects in the bucket the
// channel owns (social-telegram, social-instagram, social-x or social-reddit,
// then social-site for everything else, see bucketFor in shared.jsx), draws
// each one from its public url and lets the team pick one or drop a new
// file in through the Supabase client. Picking sets asset_bucket and
// asset_path on the release, the function builds the public url from those
// two at post time, so the page never stores a url.
//
// ── UPLOAD ──────────────────────────────────────────────────────────────────
// Path is the date plus the kebab of the file name, no folders, so the list
// call at the root sees everything. upsert is off, a second drop of the same
// name the same day gets a storage error rather than a silent overwrite.
// webp is preferred and the note says so after a png or jpg lands, the
// upload is not refused, telegram and the rest take either.
//
// ── WHAT THE LIST HIDES ─────────────────────────────────────────────────────
// Storage returns folders as rows with a null id and keeps a
// .emptyFolderPlaceholder file in some buckets. Both are filtered. Anything
// that is not an image by extension shows its name in place of a thumbnail.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, VStack, HStack, Text, SimpleGrid, Spinner, Image, Icon, Input } from '@chakra-ui/react';
import { TbUpload, TbX, TbCheck } from 'react-icons/tb';
import { supabase } from '../../../lib/supabase';
import { P, Field } from './shared';
import { TYPE, EASE, FAST } from '../../../theme/layout';

const isImage = (name) => /\.(webp|png|jpe?g|gif|avif)$/i.test(name);

const kebab = (s) => String(s || '')
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const AssetPicker = ({ bucket, selectedBucket, selectedPath, onPick }) => {
  const [objects, setObjects] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setObjects(null);
    const { data, error } = await supabase.storage
      .from(bucket)
      .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) {
      setObjects([]);
      setNote(`could not read ${bucket}. ${error.message}`);
      return;
    }
    setObjects((data || []).filter((o) => o.id && !o.name.startsWith('.')));
  }, [bucket]);

  useEffect(() => { setNote(''); load(); }, [load]);

  const publicUrl = (path) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

  const upload = async (file) => {
    if (!file || busy) return;
    setBusy(true);
    setNote('');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const stem = kebab(file.name.replace(/\.[^.]+$/, '')) || 'asset';
    const path = `${new Date().toISOString().slice(0, 10)}-${stem}.${ext}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' });
    setBusy(false);
    if (error) {
      setNote(`upload failed. ${error.message}`);
      return;
    }
    if (ext !== 'webp') setNote('landed. webp is preferred, cwebp -q 82 next time.');
    onPick(bucket, path);
    load();
  };

  const selected = (name) => selectedBucket === bucket && selectedPath === name;

  return (
    <Field label="Picture" hint={bucket}>
      <VStack align="stretch" spacing={2.5}>
        <HStack spacing={2.5}>
          <HStack as="button" type="button" onClick={() => fileRef.current && fileRef.current.click()} spacing={1.5}
            bg={P.sheet} border="1px solid" borderColor={P.hair} color={P.ink} borderRadius="full" px={3.5} h="34px"
            fontSize={TYPE.small} fontWeight="600" opacity={busy ? 0.6 : 1} pointerEvents={busy ? 'none' : 'auto'}
            _hover={{ borderColor: P.limeDeep }} transition={`border-color ${FAST} ${EASE}`}>
            {busy ? <Spinner size="xs" color={P.inkMuted} /> : <Icon as={TbUpload} boxSize={3.5} />}
            <Text>{busy ? 'uploading' : 'upload'}</Text>
          </HStack>
          {selectedBucket && selectedPath && (
            <HStack as="button" type="button" onClick={() => onPick(null, null)} spacing={1}
              color={P.inkMuted} _hover={{ color: P.coral }} transition={`color ${FAST} ${EASE}`}>
              <Icon as={TbX} boxSize={3.5} />
              <Text fontFamily="mono" fontSize={TYPE.label}>clear</Text>
            </HStack>
          )}
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>webp preferred</Text>
        </HStack>
        <Input ref={fileRef} type="file" accept="image/*" display="none"
          onChange={(e) => { upload(e.target.files && e.target.files[0]); e.target.value = ''; }} />

        {note && <Text fontFamily="mono" fontSize={TYPE.label} color={P.limeDeep}>{note}</Text>}

        {objects === null && (
          <HStack justify="center" py={6}><Spinner size="sm" color={P.inkMuted} /></HStack>
        )}

        {objects !== null && objects.length === 0 && (
          <Text fontSize={TYPE.small} color={P.inkFaint} py={2}>Nothing on this shelf yet.</Text>
        )}

        {objects !== null && objects.length > 0 && (
          <SimpleGrid columns={{ base: 3, sm: 4 }} spacing={2}>
            {objects.map((o) => {
              const on = selected(o.name);
              return (
                <Box key={o.name} as="button" type="button" onClick={() => onPick(bucket, o.name)} title={o.name}
                  position="relative" borderRadius="10px" overflow="hidden" bg={P.sunken}
                  border="2px solid" borderColor={on ? P.limeDeep : 'transparent'}
                  _hover={{ borderColor: on ? P.limeDeep : P.inkFaint }} transition={`border-color ${FAST} ${EASE}`}>
                  <Box pt="100%" position="relative">
                    {isImage(o.name) ? (
                      <Image src={publicUrl(o.name)} alt={o.name} position="absolute" inset={0}
                        w="100%" h="100%" objectFit="cover" loading="lazy" />
                    ) : (
                      <Text position="absolute" inset={0} p={2} fontFamily="mono" fontSize={TYPE.micro}
                        color={P.inkMuted} textAlign="left" noOfLines={4}>
                        {o.name}
                      </Text>
                    )}
                  </Box>
                  {on && (
                    <Box position="absolute" top={1.5} right={1.5} boxSize="18px" borderRadius="full"
                      bg={P.lime} color={P.limeInk} display="flex" alignItems="center" justifyContent="center">
                      <Icon as={TbCheck} boxSize={3} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </SimpleGrid>
        )}

        {selectedBucket && selectedPath && (
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkMuted} noOfLines={1}>
            {selectedBucket}/{selectedPath}
          </Text>
        )}
      </VStack>
    </Field>
  );
};

export default AssetPicker;
