# Native image dependency sources

The unchanged Windows sharp 0.35.3 binaries use libvips 8.18.3, as recorded in libvips-versions.json. sharp-libvips v1.3.2 supplies the matching third-party notices.

- sharp source/build: https://github.com/lovell/sharp/tree/v0.35.3
- Windows packaging: https://github.com/lovell/sharp-libvips/tree/v1.3.2
- libvips source: https://github.com/libvips/libvips/tree/v8.18.3
- Exact Windows dependency build recipes, patches, source download URLs and checksums: https://github.com/libvips/build-win64-mxe/tree/v8.18.3
- Matching Windows developer distribution, including headers and import libraries: https://github.com/libvips/build-win64-mxe/releases/tag/v8.18.3

The LGPL libraries remain dynamically loaded DLLs in cli/node_modules/@img/sharp-win32-x64/lib. Users may replace them with compatible modified builds, including for debugging modifications; this bridge adds no restriction or signature check on those DLLs after installation. The installer ZIP checksum verifies the distributed archive, not subsequent modifications. GPL-3.0 is supplied at the repository/bundle root and LGPL-3.0 in this directory. The upstream notice table lists the remaining dependencies and their licenses.
