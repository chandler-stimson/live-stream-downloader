#!/usr/bin/env bash

fileName="segment"
encyptionKeyFile="crypt.key"
openssl rand 16 > $encyptionKeyFile
encryptionKey=`cat $encyptionKeyFile | hexdump -e '16/1 "%02x"'`

splitFilePrefix="$fileName.split."
encryptedSplitFilePrefix="${splitFilePrefix}enc."

numberOfTsFiles=`ls ${splitFilePrefix}*.ts | wc -l`

for i in {0..$numberOfTsFiles}; do
    initializationVector=`printf '%032x' $i`
    openssl aes-128-cbc -e -in ${splitFilePrefix}$i.ts -out ${encryptedSplitFilePrefix}$i.ts -nosalt -iv $initializationVector -K $encryptionKey
    rm ${splitFilePrefix}$i.ts
done
