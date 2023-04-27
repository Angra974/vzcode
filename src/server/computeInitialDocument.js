import fs from 'fs';
import path from 'path';
import { randomId } from '../randomId.js';
import { enableDirectories } from '../featureFlags.js';

const isDirectory = (file) => file.endsWith('/');

// Lists files from the file system,
// converts them into the VZCode internal
// ShareDB-compatible data structure.
export const computeInitialDocument = ({ fullPath }) => {
  // Isolate files, not directories.
  // Inspired by https://stackoverflow.com/questions/41472161/fs-readdir-ignore-directories

  const unsearchedDirectories = [''];

  // Initialize the document using our data structure for representing files.
  //  * Keys are file ids, which are random numbers.
  //  * Values are objects with properties:
  //    * text - the text content of the file
  //    * name - the file name
  const initialDocument = {};

  // Stack for recursively traversing directories.
  let files = [];

  while (unsearchedDirectories.length !== 0) {
    const currentDirectory = unsearchedDirectories.pop();
    const currentDirectoryPath = path.join(fullPath, currentDirectory);
    const newFiles = fs
      .readdirSync(currentDirectoryPath, { withFileTypes: true })
      .filter((dirent) => (enableDirectories ? true : dirent.isFile()))

      // Add a trailing slash for directories
      .map((dirent) => {
        const relativePath =
          currentDirectory === ''
            ? dirent.name
            : currentDirectory + '/' + dirent.name;

        if (dirent.isFile()) {
          return relativePath;
        }
        unsearchedDirectories.push(relativePath);
        return relativePath + '/';
      });
    // console.log(currentDirectory);

    files = [...files, ...newFiles];
  }

  //console.log(files);

  files.forEach((file) => {
    const id = randomId();
    initialDocument[id] = {
      text: isDirectory(file)
        ? null
        : fs.readFileSync(path.join(fullPath, file), 'utf-8'),
      name: file,
    };
  });
  return initialDocument;
};
